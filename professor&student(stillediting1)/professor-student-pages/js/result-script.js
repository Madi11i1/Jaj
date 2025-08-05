// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore,
    doc,
    getDoc,
    query, 
    collection, 
    where,
    getDocs,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAI30r2_rI6vsuoaZIvzZQkauZ0d7KlhwI",
    authDomain: "infohive-fda92.firebaseapp.com",
    projectId: "infohive-fda92",
    storageBucket: "infohive-fda92.firebasestorage.app",
    messagingSenderId: "938794496627",
    appId: "1:938794496627:web:467f85ce9e035a2136b006",
    measurementId: "G-TE8QT8BVD5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// Global variable to store exam results
let currentExamResults = null;

// Load exam results
async function loadExamResults() {
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    
    if (!examId) {
        showError("No exam ID provided in URL parameters");
        return;
    }

    try {
        const docSnap = await getDoc(doc(db, "examResults", examId));
        if (docSnap.exists()) {
            currentExamResults = docSnap.data();
            console.log("Loaded results from Firestore:", currentExamResults);
            
            // Special handling for comprehensive exams
            if (currentExamResults.mode === 'comprehensive') {
                currentExamResults.subject = "Comprehensive Exam";
            }
            
            displayBasicResults(currentExamResults);
            displayWrongAnswers(currentExamResults);
            await loadSmartRecommendations(currentExamResults);
            
            if (currentExamResults.analysis) {
                displayAIAnalysis(currentExamResults);
            }
        } else {
            showError("Exam results not found in Firestore");
        }
    } catch (error) {
        showError(`Failed to load exam results: ${error.message}`);
    }
}

// Show error message
function showError(message) {
    console.error(message);
    const container = document.querySelector('.exam-results-container') || document.body;
    container.innerHTML = `
        <div class="error-message">
            <h2>Error Loading Results</h2>
            <p>${message}</p>
            <button onclick="location.reload()">Try Again</button>
        </div>
    `;
}

// Helper functions
function safeSetText(selector, text) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
}

function displayBasicResults(results) {
    if (!results) return;

    const subjectElement = document.querySelector('.exam-subject');
    if (subjectElement) {
        subjectElement.textContent = results.subject || "General Knowledge";
    }

    let correctAnswers = 0;
    results.questions.forEach(question => {
        const userAnswer = results.answers[question.id]?.answer;
        const isCorrect = normalizeAnswer(userAnswer, question.options) === 
                         normalizeAnswer(question.correctAnswer, question.options);
        if (isCorrect) correctAnswers++;
    });

    const scorePercentage = Math.round((correctAnswers / results.questions.length) * 100);
    
    // Update elements safely
    safeSetText('.score-percent', `${scorePercentage}%`);
    safeSetText('.result-value', `${correctAnswers}/${results.questions.length}`);
    
    // Update student performance
    const performanceElement = document.querySelector('.performance-value');
    if (performanceElement) {
        if (scorePercentage >= 80) {
            performanceElement.textContent = "Excellent";
            performanceElement.className = "performance-value excellent";
        } else if (scorePercentage >= 50) {
            performanceElement.textContent = "Average";
            performanceElement.className = "performance-value average";
        } else {
            performanceElement.textContent = "Needs Improvement";
            performanceElement.className = "performance-value poor";
        }
    }

    // Update circular progress
    const scoreCircle = document.querySelector('.circular-progress');
    const progressValue = document.querySelector('.progress-value');
    
    if (scoreCircle && progressValue) {
        scoreCircle.style.setProperty('--percentage', `${scorePercentage}%`);
        progressValue.textContent = `${scorePercentage}%`; 
    }
}

// Answer normalization
function normalizeAnswer(answer, options) {
    if (!answer) return null;
    
    if (typeof answer === 'string' && /^[A-Da-d]$/.test(answer)) {
        const index = answer.toUpperCase().charCodeAt(0) - 65;
        return options[index]?.toLowerCase().trim();
    }
    return String(answer).toLowerCase().trim();
}

// Get answer text
function getAnswerText(answer, options) {
    if (!answer) return 'Unanswered';
    
    if (typeof answer === 'string' && /^[A-Da-d]$/.test(answer)) {
        const index = answer.toUpperCase().charCodeAt(0) - 65;
        return options[index] || answer;
    }
    return answer;
}

// Authentication state change
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadExamResults();
  } else {
    window.location.href = "/login.html";
  }
});

// Get subject ID by name


// Display AI analysis
function displayAIAnalysis(results) {
    const container = document.querySelector('.ai-analysis-section');
    if (!container) return;
    
    // حساب عدد الإجابات الصحيحة
    const correctAnswers = results.questions.reduce((count, question) => {
        const userAnswer = results.answers[question.id]?.answer;
        const isCorrect = normalizeAnswer(userAnswer, question.options) === 
                         normalizeAnswer(question.correctAnswer, question.options);
        return isCorrect ? count + 1 : count;
    }, 0);

    // تحليل المواضيع الضعيفة
    const weakTopics = analyzeMistakes(results);
    const weakTopicsList = weakTopics.length > 0 
        ? `<ul>${weakTopics.map(topic => `<li>${topic}</li>`).join('')}</ul>` 
        : '<p>No significant weak areas identified</p>';
    
    // نصيحة بناءً على النتيجة
    let advice = "";
    if (results.score >= 80) {
        advice = "Excellent performance! Maintain your study habits and focus on advanced topics.";
    } else if (results.score >= 50) {
        advice = "Solid performance. Focus on your weak areas to reach the next level.";
    } else {
        advice = "Spend more time reviewing core concepts. Practice regularly to improve.";
    }
    
    let analysisHTML = `
        <div class="ai-analysis-card">
            <h3><i class="fas fa-robot"></i> AI Performance Analysis</h3>
            
            <div class="analysis-summary">
                <div class="performance-insight">
                    <h4>Overall Performance</h4>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${results.score}%">
                            <span>${results.score}% Score</span>
                        </div>
                    </div>
                    <p>${advice}</p>
                </div>
                
                <div class="weak-topics">
                    <h4><i class="fas fa-exclamation-triangle"></i> Areas Needing Improvement</h4>
                    ${weakTopicsList}
                </div>
            </div>
            
            <div class="detailed-analysis">
                <div class="time-analysis">
                    <h5><i class="fas fa-clock"></i> Time Management</h5>
                    <p>Total exam time: ${Math.floor(results.analysis.timeSpent / 60)}m ${results.analysis.timeSpent % 60}s</p>
                    <p>Average per question: ${(results.analysis.timeSpent / results.questions.length).toFixed(1)}s</p>
                </div>
                
                <div class="accuracy-analysis">
                    <h5><i class="fas fa-bullseye"></i> Accuracy Patterns</h5>
                    <p>Correct answers: ${correctAnswers}/${results.questions.length}</p>
                    <p>Most mistakes in: ${weakTopics.length > 0 ? weakTopics[0] : 'N/A'}</p>
                </div>
            </div>
            
            <div class="study-tips">
                <h5><i class="fas fa-lightbulb"></i> Recommended Study Tips</h5>
                <ul>
                    <li>Focus on practicing ${weakTopics.length > 0 ? weakTopics[0] : 'core concepts'}</li>
                    <li>Review time management strategies</li>
                    <li>Take practice quizzes regularly</li>
                </ul>
            </div>
        </div>
    `;
    
    container.innerHTML = analysisHTML;
}
// Create recommendation card
function createRecommendationCard(recommendation, relevance = 0) {
const card = document.createElement('div');
    card.className = 'recommendation-card';
    
    // تحديد النوع والنص المناسب
    let icon = 'fa-lightbulb';
    let typeClass = 'other';
    let linkText = 'View Resource';
    
if (recommendation.type) {
    const type = recommendation.type.toLowerCase();
    
    if (type.includes('article')) {
        icon = 'fa-file-alt';
        linkText = 'Read Article';
        typeClass = 'article';
    } else if (type.includes('video')) {
        icon = 'fa-video';
        linkText = 'Watch Video';
        typeClass = 'video';
    } else if (type.includes('exercise') || type.includes('practice') || type.includes('quiz')) {
        icon = 'fa-pencil-alt';
        linkText = 'Solve Exercise';
        typeClass = 'exercise';
    }
}
    
    // الحصول على الرابط سواء كان في link أو resources (دعم للبيانات الجديدة والقديمة)
    const resourceLink = recommendation.link || recommendation.resources || '';
    
    // تقصير المحتوى إذا لزم الأمر
    const shortContent = recommendation.content 
        ? (recommendation.content.length > 200 
            ? recommendation.content.substring(0, 200) + '...' 
            : recommendation.content)
        : 'This is a sample recommendation content';
    
    card.innerHTML = `
       <div class="recommendation-header">
            <div class="recommendation-header-left">
                <div class="recommendation-icon ${typeClass}"> <!-- أضف الكلاس هنا -->
                    <i class="fas ${icon}"></i>
                </div>
                <h3 class="recommendation-title">${recommendation.title || 'Sample Recommendation'}</h3>
            </div>
            <div class="recommendation-relevance">${relevance} match</div>
        </div>
        
        <div class="recommendation-content">
            <p>${shortContent}</p>
        </div>
        
        <div class="recommendation-footer">
            <div class="recommendation-tags">
                ${(recommendation.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            ${resourceLink ? `
                <a href="${resourceLink}" target="_blank" class="recommendation-link">
                    <i class="fas fa-external-link-alt"></i> ${linkText}
                </a>
            ` : ''}
        </div>
    `;
    
    // جعل البطاقة قابلة للنقر إذا كان هناك رابط
    if (resourceLink) {
        card.classList.add('clickable-card');
        
        // حل أكثر موثوقية لفتح الرابط
        card.addEventListener('click', (e) => {
            // فتح الرابط فقط إذا لم يكن النقر على زر أو رابط
            if (!e.target.closest('button') && !e.target.closest('a')) {
                window.open(resourceLink, '_blank');
            }
        });
        
        // إضافة معالج للرابط لمنع فتحه مرتين
        const linkElement = card.querySelector('.recommendation-link');
        if (linkElement) {
            linkElement.addEventListener('click', function(e) {
                e.stopPropagation(); // منع انتشار الحدث إلى البطاقة
            });
        }
    }
    
    return card;
}

// Display wrong answers
function displayWrongAnswers(results) {
    const container = document.querySelector('.wrong-answers-container');
    if (!container) return;

    container.innerHTML = '<h3>Wrong Answers Review</h3>';
    let hasWrongAnswers = false;

    results.questions.forEach(question => {
        const answerObj = results.answers[question.id]?.answer;
        const userAnswer = answerObj ? answerObj.answer : null;
        const isCorrect = normalizeAnswer(userAnswer, question.options) === 
                         normalizeAnswer(question.correctAnswer, question.options);

        if (!isCorrect) {
            hasWrongAnswers = true;
            const userAnswerText = getAnswerText(userAnswer, question.options);
            const correctAnswerText = getAnswerText(question.correctAnswer, question.options);

            container.innerHTML += `
                <div class="wrong-answer">
                    <p><strong>Question:</strong> ${question.question}</p>
                    <p class="wrong"><strong>Your Answer:</strong> ${userAnswerText || 'Unanswered'}</p>
                    <p class="correct"><strong>Correct Answer:</strong> ${correctAnswerText}</p>
                    ${question.explanation ? `<p class="explanation">${question.explanation}</p>` : ''}
                </div>
            `;
        }
    });

    if (!hasWrongAnswers) {
        container.innerHTML += '<p class="no-wrong-answers">All answers were correct!</p>';
    }
}

// Load smart recommendations
async function loadSmartRecommendations(results) {
  const container = document.getElementById('smartRecommendations');
  if (!container) {
    console.error('Smart recommendations container not found!');
    return;
  }
  
  // Analyze mistakes
  const weakTopics = analyzeMistakes(results);
  if (!weakTopics || weakTopics.length === 0) {
    container.innerHTML = '<p>No weak topics found for recommendations</p>';
    return;
  }

  try {
    console.log("Identified weak topics:", weakTopics);
    
    const q = query(
      collection(db, "recommendations"),
      where("tags", "array-contains-any", weakTopics),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    console.log('Smart recommendations found:', snapshot.size);
    
    if (snapshot.empty) {
      container.innerHTML = '<p>No recommendations available for these topics</p>';
      return;
    }
    
    container.innerHTML = '';
    
    // Sort recommendations by relevance
    const recommendations = [];
    snapshot.forEach(doc => {
        const rec = doc.data();
        const relevance = rec.tags?.filter(tag => weakTopics.includes(tag)).length || 0;
        recommendations.push({rec, relevance});
    });
    
    recommendations.sort((a, b) => b.relevance - a.relevance);
    
    // Add recommendations to container
    recommendations.forEach(({rec, relevance}) => {
        container.appendChild(createRecommendationCard(rec, relevance));
    });
    
  } catch (error) {
    console.error("Error loading smart recommendations:", error);
    container.innerHTML = `<p class="error">Error: ${error.message}</p>`;
  }
}

// Analyze mistakes to find weak topics
function analyzeMistakes(results) {
  const weakTopics = {};
  
  results.questions.forEach(question => {
    const answerObj = results.answers[question.id];
    const userAnswer = answerObj ? answerObj.answer : null;
    
    const isCorrect = normalizeAnswer(userAnswer, question.options) === 
                     normalizeAnswer(question.correctAnswer, question.options);
    
    if (!isCorrect && question.tags) {
      question.tags.forEach(tag => {
        weakTopics[tag] = (weakTopics[tag] || 0) + 1;
      });
    }
  });
  
  return Object.entries(weakTopics)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
}


// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const retakeBtn = document.getElementById('retakeBtn');
    if (retakeBtn) {
// في قسم retakeBtn event listener
retakeBtn.addEventListener('click', function(e) {
    e.preventDefault();
    
    const storedResults = localStorage.getItem('examResults');
    if (!storedResults) {
        alert('لا توجد بيانات اختبار متاحة لإعادة المحاولة');
        return;
    }
    
    try {
        const results = JSON.parse(storedResults);
        console.log("Results for retake:", results);
        
        // استخدام اسم المادة من النتائج بدلاً من examId
        let retakeUrl = '';
        
        if (results.mode === 'comprehensive') {
            retakeUrl = 'Questions.html?mode=comprehensive';
        } else {
            retakeUrl = `Questions.html?subject=${encodeURIComponent(results.subject)}`;
        }
        
        // إضافة إعادة توجيه احتياطية في حالة الخطأ
        const backupUrl = 'Questions.html';
        const timestamp = Date.now();
        
        console.log("Redirecting to:", retakeUrl);
        window.location.href = `${retakeUrl}&t=${timestamp}`;
        
        // إعادة توجيه احتياطية في حالة فشل الأولى
        setTimeout(() => {
            if (window.location.href.includes('result.html')) {
                window.location.href = `${backupUrl}?t=${timestamp}`;
            }
        }, 2000);
        
    } catch (error) {
        console.error("Error parsing exam results:", error);
        alert('حدث خطأ في تحليل بيانات الاختبار');
    }
});
    }
});
