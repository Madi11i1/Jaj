// Import Firebase functions (using specific versions for better control)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    query,
    where,
    limit,
    doc, 
    setDoc,
    getDoc, 
    serverTimestamp // Ensure doc, setDoc, serverTimestamp are imported for Firestore operations
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// Firebase configuration - Ensure this matches your project's configuration
const firebaseConfig = {
    apiKey: "AIzaSyAI30r2_rI6vsuoaZIvzZQkauZ0d7KlhwI",
    authDomain: "infohive-fda92.firebaseapp.com",
    projectId: "infohive-fda92",
    storageBucket: "infohive-fda92.appspot.com", // Corrected storageBucket if needed (from .firebasestorage.app)
    messagingSenderId: "938794496627",
    appId: "1:938794496627:web:467f85ce9e035a2136b006",
    measurementId: "G-TE8QT8BVD5"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // Initialize Firebase Authentication

// Exam data structure
let examData = {
    totalQuestions: 0,
    currentQuestion: 1,
    timeRemaining: 0,
    questions: [],
    subject: "",
    mode: "subject",
    totalDuration: 0,
    answers: {},
    studentId: null, // This will be dynamically set by onAuthStateChanged
    studentName: "Guest" // Default, can be updated from user profile if available
};

// Get subject and mode from URL
function getParamsFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if we have examId parameter
    const examId = urlParams.get('examId');
    if (examId) {
        return { 
            mode: 'retake', 
            examId: examId,
            subject: 'Retake Exam' 
        };
    }
    
    // Otherwise get subject and mode normally
    return {
        mode: urlParams.get('mode') || 'subject',
        subject: urlParams.get('subject') || 'cybersecurity'
    };
}

// Timer functionality
let timerInterval;
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const timerElement = document.getElementById('timer');
    const minutes = Math.floor(examData.timeRemaining / 60);
    const seconds = examData.timeRemaining % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (examData.timeRemaining <= 0) {
        clearInterval(timerInterval);
        timerElement.textContent = "00:00";
        timerElement.classList.add('time-up');
        submitExam(); // Auto-submit when time is up
    } else {
        examData.timeRemaining--;
    }
}

// Load questions from Firestore
async function loadQuestionsFromFirestore() {
    try {
        const params = getParamsFromURL();
        const subject = params.subject.toLowerCase();
        const mode = params.mode;
        
        console.log("جلب الأسئلة للمادة:", subject, "النمط:", mode);

        const mcqsCollection = collection(db, "mcqs");
        let allQuestions = [];

        examData.mode = mode;
        examData.subject = subject;

        if (mode === 'comprehensive') {
            // كود الاختبار الشامل - جلب أسئلة من جميع المواد
            console.log("بدء جلب الأسئلة للاختبار الشامل...");
            
            // 1. جلب جميع المواد
            const subjectsSnapshot = await getDocs(collection(db, "subjects"));
            const subjectIds = subjectsSnapshot.docs.map(doc => doc.id);
            
            // 2. جلب أسئلة كل مادة
            for (const subjectId of subjectIds) {
                const questionsSnapshot = await getDocs(query(
                    mcqsCollection,
                    where("subjectId", "==", subjectId),
                    limit(30) // جلب 30 سؤال من كل مادة للحفاظ على حجم معقول
                ));
                
                questionsSnapshot.docs.forEach(doc => {
                    allQuestions.push({ 
                        id: doc.id, 
                        ...doc.data() 
                    });
                });
            }
            
            // خلط الأسئلة عشوائيًا
            examData.questions = shuffleArray(allQuestions).slice(0, 100); // اختر 100 سؤال عشوائيًا
            console.log(`تم جلب ${examData.questions.length} سؤال للاختبار الشامل`);
        } else {
            // كود الاختبار العادي (كما هو سابقًا)
            // 1. جلب جميع المواد المتاحة
            const subjectsSnapshot = await getDocs(collection(db, "subjects"));
            
            // 2. البحث بطريقتين (ID أو Name) لتجنب الأخطاء
            const subjectDoc = subjectsSnapshot.docs.find(doc => {
                const docId = doc.id.toLowerCase().replace(/-/g, ' ');
                const docName = doc.data().name.toLowerCase().replace(/-/g, ' ');
                const searchSubject = subject.replace(/-/g, ' ');
                
                return docId === searchSubject || docName === searchSubject;
            });

            if (!subjectDoc) {
                // 3. رسالة خطأ مفصلة في حال عدم العثور على المادة
                const availableSubjects = subjectsSnapshot.docs.map(doc => 
                    `ID: ${doc.id}, Name: ${doc.data().name}`
                ).join('\n');
                
                throw new Error(
                    `المادة "${subject}" غير موجودة.\nالمواد المتاحة:\n${availableSubjects}`
                );
            }
            
            // 4. جلب أسئلة المادة
            const subjectId = subjectDoc.id;
            console.log("Found subject ID:", subjectId);
            
            const questionsSnapshot = await getDocs(query(
                mcqsCollection,
                where("subjectId", "==", subjectId),
                limit(100)
            ));
            
            examData.questions = questionsSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            console.log("Questions loaded:", examData.questions.length);
        }

        // Filter out questions without valid options
        examData.questions = examData.questions.filter(q => 
            q.options && Array.isArray(q.options) && q.options.length >= 2
        );

        if (examData.questions.length === 0) {
            throw new Error("No valid questions found after filtering. Please check your data.");
        }

        examData.totalQuestions = examData.questions.length;
        examData.totalDuration = Math.ceil(examData.totalQuestions * 1.5);
        examData.timeRemaining = examData.totalDuration * 60;

        // Update UI and start timer
        updateExamInfo();
        updateQuestionDisplay();
        generateQuestionIndicators();
        startTimer();

    } catch (error) {
        console.error("Error loading questions:", error);
        document.getElementById('options-container').innerHTML = `
            <div class="error-alert">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error Loading Questions</h3>
                <p>${error.message}</p>
                <button onclick="location.reload()">Reload Page</button>
            </div>
        `;
        document.getElementById('question-text').textContent = "Failed to load questions.";
    }
}

// Shuffle array function (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Update exam info display
function updateExamInfo() {
    let examTitle;
    if (examData.mode === 'comprehensive') {
        examTitle = "Comprehensive Certification Exam";
        document.querySelector('.exam-info p').innerHTML = `
            Total Questions: <span>${examData.totalQuestions}</span> | 
            Time Allotted: <span>${examData.totalDuration}</span> minutes |
            <span>All Subjects</span>
        `;
    } else {
        const subjectName = examData.subject.charAt(0).toUpperCase() + examData.subject.slice(1);
        examTitle = `${subjectName} Certification Exam`;
        document.querySelector('.exam-info p').innerHTML = `
            Total Questions: <span>${examData.totalQuestions}</span> | 
            Time Allotted: <span>${examData.totalDuration}</span> minutes |
            Subject: <span>${subjectName}</span>
        `;
    }
    document.querySelector('.exam-info h1').textContent = examTitle;
    document.getElementById('exam-title').textContent = examTitle;
}

// Flag button functionality
function setupFlagButton() {
    const flagBtn = document.getElementById('flagBtn');
    flagBtn.addEventListener('click', function() {
        const questionId = examData.questions[examData.currentQuestion - 1].id;
        examData.answers[questionId] = examData.answers[questionId] || {};
        examData.answers[questionId].flagged = !examData.answers[questionId].flagged;
        
        this.classList.toggle('flagged');
        this.innerHTML = examData.answers[questionId].flagged ? 
            '<i class="fas fa-flag"></i> Flagged for Review' : 
            '<i class="fas fa-flag"></i> Flag for Review';
        
        updateQuestionIndicators();
    });
}

// Option selection functionality
function setupOptionSelection() {
    document.getElementById('options-container').addEventListener('click', function(e) {
        const optionElement = e.target.closest('.option');
        if (!optionElement) return;

        const options = this.querySelectorAll('.option');
        options.forEach(opt => opt.classList.remove('selected'));
        optionElement.classList.add('selected');

        const questionId = examData.questions[examData.currentQuestion - 1].id;
        const selectedOptionLetter = optionElement.querySelector('.option-letter').textContent; // مثل "A"
        examData.answers[questionId] = { answer: selectedOptionLetter }; // تخزين الحرف فقط
    });
}


// Navigation controls
function setupNavigationControls() {
    document.getElementById('prevBtn').addEventListener('click', function() {
        if (examData.currentQuestion > 1) {
            examData.currentQuestion--;
            updateQuestionDisplay();
        }
    });

    document.getElementById('nextBtn').addEventListener('click', function() {
        if (examData.currentQuestion < examData.totalQuestions) {
            examData.currentQuestion++;
            updateQuestionDisplay();
        }
    });
}

// Submit exam functionality
function setupSubmitButton() {
    document.getElementById('submitBtn').addEventListener('click', function() {
        const answered = Object.values(examData.answers).filter(a => a.answer).length;
        const unanswered = examData.totalQuestions - answered;
        
        if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) {
            return; // User cancelled submission
        }
        submitExam();
    });
}

// Adding result with data analysis
async function submitExam() {
    clearInterval(timerInterval); // Stop the timer
    
    // Create a unique ID for the exam result
    const examId = `result_${Date.now()}_${examData.studentId}`;
    
    // Calculate results and additional analytical data
    const results = {
        examId: examId,
        studentId: examData.studentId, // Dynamically set studentId
        studentName: examData.studentName, // Use dynamic name (if available)
        subject: examData.subject,
        mode: examData.mode,
        totalQuestions: examData.totalQuestions,
        answered: Object.values(examData.answers).filter(a => a.answer).length,
        flagged: Object.values(examData.answers).filter(a => a.flagged).length,
        answers: examData.answers,
        questions: examData.questions, // Store questions for detailed review later
        score: calculateScore(),
        timestamp: serverTimestamp(),
        analysis: {
            timeSpent: (examData.totalDuration * 60) - examData.timeRemaining,
        }
    };

    try {
        // Save to Firestore
        await setDoc(doc(db, "examResults", examId), results);
        console.log("Exam results saved to Firestore:", examId);
        
        // Save to localStorage for immediate results page display
        localStorage.setItem('examResults', JSON.stringify(results));
        
        // Navigate to the results page, passing the examId
        window.location.href = `result.html?examId=${examId}`;
    } catch (error) {
        console.error("Error saving exam results:", error);
        alert("An error occurred while saving your results. Please try again: " + error.message);
    }
}


function calculateScore() {
    let correctAnswers = 0;
    console.log("--- Calculating Score ---");
    
    examData.questions.forEach(question => {
        const userAnswerLetter = examData.answers[question.id]?.answer; // مثل "A"
        const userAnswerText = question.options[userAnswerLetter?.charCodeAt(0) - 65]; // تحويل "A" → نص الخيار
        
        console.log(`Q: ${question.id} | User: ${userAnswerText} | Correct: ${question.correctAnswer}`);
        
        if (userAnswerText && userAnswerText === question.correctAnswer) {
            correctAnswers++;
        }
    });
    
    const score = Math.round((correctAnswers / examData.totalQuestions) * 100);
    console.log(`Correct: ${correctAnswers}/${examData.totalQuestions} | Score: ${score}%`);
    return score;
}

// Question indicators functionality (to show progress grid)
function generateQuestionIndicators() {
    const grid = document.getElementById('questions-grid');
    grid.innerHTML = ''; // Clear previous indicators
    
    for (let i = 1; i <= examData.totalQuestions; i++) {
        const indicator = document.createElement('div');
        indicator.className = 'question-indicator';
        indicator.textContent = i;
        
        if (i === examData.currentQuestion) {
            indicator.classList.add('current');
        }
        
        const questionId = examData.questions[i - 1]?.id;
        if (questionId && examData.answers[questionId]?.answer) {
            indicator.classList.add('answered');
        }
        if (questionId && examData.answers[questionId]?.flagged) {
            indicator.classList.add('flagged');
        }
        
        indicator.addEventListener('click', function() {
            examData.currentQuestion = i;
            updateQuestionDisplay();
        });
        
        grid.appendChild(indicator);
    }
}

function updateQuestionIndicators() {
    // This function can be called more frequently to update status
    // It rebuilds the grid for simplicity, but more efficient updates are possible
    generateQuestionIndicators(); 
}

// Update question display (question text and options)
function updateQuestionDisplay() {
    // Handle cases where no questions are loaded or current question is out of bounds
    if (examData.questions.length === 0 || examData.currentQuestion < 1 || examData.currentQuestion > examData.totalQuestions) {
        document.getElementById('question-text').textContent = "No question available or error loading.";
        document.getElementById('options-container').innerHTML = "<p>Please ensure you are logged in and questions exist for this subject/mode.</p>";
        return;
    }
    
    const currentQ = examData.questions[examData.currentQuestion - 1];
    const questionId = currentQ.id; 
    
    // Update question number display
    document.getElementById('current-question').textContent = `Question ${examData.currentQuestion} / ${examData.totalQuestions}`;

    // Update question text
    document.getElementById('question-text').textContent = currentQ.question || "No question text available";
    
    // Update options
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = ''; // Clear previous options
    
    if (!currentQ.options || currentQ.options.length === 0) {
        optionsContainer.innerHTML = '<p class="error">No options available for this question</p>';
        return;
    }
    
    // Dynamically create option elements
    currentQ.options.forEach((optionText, index) => {
        if (!optionText) return; // Skip if option text is empty
        
        const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        
        // Mark option as 'selected' if it's the user's saved answer for this question
        if (examData.answers[questionId]?.answer === optionLetter) {
            optionElement.classList.add('selected');
        }
        
        optionElement.innerHTML = `
            <div class="option-letter">${optionLetter}</div>
            <div class="option-text">${optionText}</div>
        `;
        optionsContainer.appendChild(optionElement);
    });
    
    // Update flag button state
    const flagBtn = document.getElementById('flagBtn');
    flagBtn.classList.toggle('flagged', examData.answers[questionId]?.flagged);
    flagBtn.innerHTML = examData.answers[questionId]?.flagged ? 
        '<i class="fas fa-flag"></i> Flagged for Review' : 
        '<i class="fas fa-flag"></i> Flag for Review';
    
    updateQuestionIndicators(); // Refresh question grid
    updateSubmitButton(); // Refresh submit button state
}

// Update submit button visual state (incomplete/complete)
function updateSubmitButton() {
    const answeredCount = Object.values(examData.answers).filter(a => a.answer).length;
    const submitBtn = document.getElementById('submitBtn');
    
    if (answeredCount < examData.totalQuestions) {
        submitBtn.classList.add('incomplete');
    } else {
        submitBtn.classList.remove('incomplete');
    }
}

// Initialize the page by setting up event listeners and checking auth state
document.addEventListener('DOMContentLoaded', function() {
    setupFlagButton();
    setupOptionSelection();
    setupNavigationControls();
    setupSubmitButton();

    // Crucial: Monitor Firebase Authentication state
    onAuthStateChanged(auth, async (user) => { // Using async here because we might fetch user data
        if (user) {
            // User is logged in
            console.log("User is logged in. UID:", user.uid);
            examData.studentId = user.uid; // Set studentId from authenticated user

            // Optional: Fetch student's name from Firestore profile (if you have a 'users' collection)
            // You'll need to enable read access for 'users' collection for authenticated users in security rules
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    examData.studentName = userDocSnap.data().name || user.displayName || "Unknown User";
                    console.log("Student Name:", examData.studentName);
                } else {
                    examData.studentName = user.displayName || "Authenticated User";
                }
            } catch (profileError) {
                console.warn("Could not fetch user profile:", profileError.message);
                examData.studentName = user.displayName || "Authenticated User"; // Fallback
            }

            loadQuestionsFromFirestore(); // Now, load questions securely
        } else {
            // No user is logged in
            console.warn("No user is logged in. Cannot load exam questions. Redirecting to login page.");
            document.getElementById('question-text').innerHTML = `
                <div class="error-alert">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Authentication Required</h3>
                    <p>Please log in to start the exam. Redirecting to login page in 3 seconds...</p>
                </div>
            `;
            // Redirect to login page after a delay
            setTimeout(() => {
                window.location.href = '../../login.html'; // Ensure this path is correct relative to questions.html
            }, 3000); 
        }
    });
});

// Initial log (will run before DOMContentLoaded, but auth state might not be ready yet)
console.log("Script loaded. Waiting for Firebase Auth state...");