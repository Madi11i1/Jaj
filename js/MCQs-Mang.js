// Update your imports to use v10.x for all Firebase services
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    getDoc
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
const auth = getAuth(app); // Initialize Firebase Authentication

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadSubjects();
  } else {
    // Redirect to login or handle unauthorized access
    console.log("User is not authenticated");
    window.location.href = "/login.html";
  }
});


// DOM Elements
const elements = {
    tabsContainer: document.getElementById('subjectTabs'),
    mcqForm: document.getElementById('mcqForm'),
    subjectSelect: document.getElementById('mcqSubject'),
    addMcqBtn: document.getElementById('addMcqBtn'),
    addMcqModal: document.getElementById('addMcqModal'),
    closeModal: document.querySelector('.close'),
    currentSubjectTitle: document.getElementById('currentSubjectTitle'),
    mcqTablesContainer: document.getElementById('mcqTablesContainer'),
    addAnotherBtn: document.getElementById('addAnotherBtn'),
    batchCounter: document.getElementById('batchCounter'),
    batchCount: document.getElementById('batchCount'),
    cardHeader: document.querySelector('.card-header')
};

// Global variables
let currentSubjectId = '';
let subjects = [];
let currentQuestionsBatch = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    setupEventListeners();
});

async function initApp() {
    try {
        await loadSubjects();
        createSubjectTabs();
        createMcqTables();
        
        if (subjects.length > 0) {
            currentSubjectId = subjects[0].id;
            elements.currentSubjectTitle.textContent = `${subjects[0].name} Questions`;
            updateTableVisibility();
            await loadMCQs(currentSubjectId);
        }
    } catch (error) {
        console.error("Initialization error:", error);
        showAlert("Error loading data", "error");
    }
}

async function loadSubjects() {
    try {
        const snapshot = await getDocs(collection(db, "subjects"));
        subjects = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));
        console.log("تم تحميل المواد:", subjects);
    } catch (error) {
        console.error("خطأ في تحميل المواد:", error);
        showAlert("خطأ في تحميل قائمة المواد", "error");
    }
}

function createSubjectTabs() {
    elements.tabsContainer.innerHTML = '';
    
    subjects.forEach((subject, index) => {
        const tab = document.createElement('div');
        tab.className = `tab ${index === 0 ? 'active' : ''}`;
        tab.textContent = subject.name;
        tab.dataset.subjectId = subject.id;
        
        tab.addEventListener('click', async () => {
            currentSubjectId = subject.id;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            elements.currentSubjectTitle.textContent = `${subject.name} Questions`;
            updateTableVisibility();
            await loadMCQs(currentSubjectId);
        });
        
        elements.tabsContainer.appendChild(tab);
    });
}

function createMcqTables() {
    elements.mcqTablesContainer.innerHTML = '';
    
    subjects.forEach(subject => {
        const table = document.createElement('table');
        table.className = 'mcq-table';
        table.id = `table-${subject.id}`;
        table.style.display = 'none';
        
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Question</th>
                    <th>Options</th>
                    <th>Correct Answer</th>
                    <th>Actions</th> <!-- تم إزالة عمود Duration -->
                </tr>
            </thead>
            <tbody id="mcqTableBody-${subject.id}"></tbody>
        `;
        
        elements.mcqTablesContainer.appendChild(table);
    });
}

function updateTableVisibility() {
    // Hide all tables
    document.querySelectorAll('.mcq-table').forEach(table => {
        table.style.display = 'none';
    });
    
    // Show only current subject table
    if (currentSubjectId) {
        const currentTable = document.getElementById(`table-${currentSubjectId}`);
        if (currentTable) {
            currentTable.style.display = 'table';
        }
    }
}

async function loadMCQs(subjectId) {
     try {
        const tbody = document.querySelector(`#mcqTableBody-${subjectId}`);
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';
        
        const q = query(collection(db, "mcqs"), where("subjectId", "==", subjectId));
        const snapshot = await getDocs(q);
        
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-questions">No questions found</td></tr>';
            return;
        }
        
        // حل مشكلة NaN - استخدام forEach مع الفهرس الصحيح
        let counter = 1;
        snapshot.forEach((doc) => {
         const mcq = doc.data();
            const row = `
                <tr data-id="${doc.id}">
                    <td>${counter++}</td>
                    <td>${mcq.question}</td>
                    <td>
                        <ul class="mcq-options-list">
                            ${mcq.options.map((opt, i) => `<li>${String.fromCharCode(97 + i)}. ${opt}</li>`).join('')}
                        </ul>
                    </td>
                    <td>${String.fromCharCode(97 + mcq.options.indexOf(mcq.correctAnswer))}</td>
                    <td> <!-- تم إزالة خلية Duration -->
                        <button class="btn btn-primary btn-sm edit-btn">Edit</button>
                        <button class="btn btn-danger btn-sm delete-btn">Delete</button>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        
        // Add event listeners to buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', handleDelete);
        });
        
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', handleEdit);
        });
        
    } catch (error) {
        console.error("Error loading MCQs:", error);
        showAlert("Error loading questions", "error");
    }
}

async function handleDelete(e) {
    const row = e.target.closest('tr');
    const mcqId = row.dataset.id;
    
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
        await deleteDoc(doc(db, "mcqs", mcqId));
        row.remove();
        showAlert("Question deleted successfully", "success");
    } catch (error) {
        console.error("Error deleting MCQ:", error);
        showAlert("Error deleting question", "error");
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const isEditing = elements.mcqForm.dataset.editingId;
    
    if (isEditing) {
        await updateQuestion(elements.mcqForm.dataset.editingId);
        delete elements.mcqForm.dataset.editingId;
    } else if (currentQuestionsBatch.length > 0) {
        await saveBatchToFirestore();
    } else {
        await saveSingleQuestion();
    }
    
    // إعادة تعيين النموذج
    const submitBtn = elements.mcqForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Save MCQ';
    elements.addMcqModal.style.display = "none";
    elements.mcqForm.reset();
}

async function saveSingleQuestion() {
    const question = document.getElementById('mcqQuestion').value;
    const subjectId = document.getElementById('mcqSubject').value;
    const tags = document.getElementById('mcqTags').value.split(',').map(tag => tag.trim());
    const explanation = document.getElementById('mcqExplanation').value;
    
    // Get options
    const options = [
        document.getElementById('text_a').value,
        document.getElementById('text_b').value,
        document.getElementById('text_c').value,
        document.getElementById('text_d').value
    ];
    
    // Get correct answer
    const correctOption = document.querySelector('input[name="correctOption"]:checked');
    if (!correctOption) {
        showAlert("Please select correct answer", "error");
        return;
    }
    
    const correctAnswer = options[correctOption.value.charCodeAt(0) - 97];
    
    try {
       await addDoc(collection(db, "mcqs"), {
    question,
    options,
    correctAnswer,
    subjectId, // الحفاظ على الربط بالمادة الأصلية
    subject: subjects.find(s => s.id === subjectId).name
      .toLowerCase()
      .replace(/\s+/g, '-'), // مثال: "operating-systems"
    createdAt: new Date(),
    tags: tags,
    explanation: explanation
  });
        
        showAlert("Question added successfully", "success");
        await loadMCQs(subjectId); // Refresh the list
        
    } catch (error) {
        console.error("Error adding MCQ:", error);
        showAlert("Error adding question", "error");
    }
}

function handleAddAnother() {
    if (!validateCurrentQuestion()) return;
    
    saveQuestionToBatch();
    resetFormForNextQuestion();
    updateBatchCounter();
}

function validateCurrentQuestion() {
    const question = document.getElementById('mcqQuestion').value;
    const optionA = document.getElementById('text_a').value;
    const optionB = document.getElementById('text_b').value;
    const optionC = document.getElementById('text_c').value;
    const optionD = document.getElementById('text_d').value;
    const correctOption = document.querySelector('input[name="correctOption"]:checked');
    
    if (!question || !optionA || !optionB || !optionC || !optionD || !correctOption) {
        showAlert("Please fill all fields and select correct answer", "error");
        return false;
    }
    
    return true;
}

function saveQuestionToBatch() {
    const question = {
        question: document.getElementById('mcqQuestion').value,
        options: [
            document.getElementById('text_a').value,
            document.getElementById('text_b').value,
            document.getElementById('text_c').value,
            document.getElementById('text_d').value
        ],
        correctAnswer: document.querySelector('input[name="correctOption"]:checked').value,
        subjectId: document.getElementById('mcqSubject').value,
        // إضافة التاغ والشرح لكل سؤال
        tags: document.getElementById('mcqTags').value.split(',').map(tag => tag.trim()),
        explanation: document.getElementById('mcqExplanation').value
    };
    
    currentQuestionsBatch.push(question);
}

function resetFormForNextQuestion() {
    document.getElementById('mcqQuestion').value = '';
    document.getElementById('text_a').value = '';
    document.getElementById('text_b').value = '';
    document.getElementById('text_c').value = '';
    document.getElementById('text_d').value = '';
    document.querySelectorAll('input[name="correctOption"]').forEach(radio => {
        radio.checked = false;
    });
    document.getElementById('mcqQuestion').focus();
}

function updateBatchCounter() {
    if (currentQuestionsBatch.length > 0) {
        elements.batchCounter.style.display = 'block';
        elements.batchCount.textContent = currentQuestionsBatch.length;
    } else {
        elements.batchCounter.style.display = 'none';
    }
}

async function saveBatchToFirestore() {
    const subjectId = document.getElementById('mcqSubject').value;
    const tags = document.getElementById('mcqTags').value.split(',').map(tag => tag.trim());
    const explanation = document.getElementById('mcqExplanation').value;
    
    try {
        for (const question of currentQuestionsBatch) {
            await addDoc(collection(db, "mcqs"), {
                question: question.question,
                options: question.options,
                correctAnswer: question.options[question.correctAnswer.charCodeAt(0) - 97],
                subjectId: question.subjectId,
                createdAt: new Date(),
                subject: subjects.find(s => s.id === question.subjectId).name
                  .toLowerCase()
                  .replace(/\s+/g, '-'),
                tags: tags,
                explanation: explanation  
            });
        }
        
        showAlert(`${currentQuestionsBatch.length} questions added successfully`, "success");
        currentQuestionsBatch = [];
        updateBatchCounter();
        await loadMCQs(subjectId);
    } catch (error) {
        console.error("Error saving batch:", error);
        showAlert("Error saving questions", "error");
    }
}

function setupEventListeners() {
        elements.addMcqBtn.addEventListener('click', () => {
        // إعادة تعيين النموذج لوضع الإضافة
        elements.mcqForm.reset();
        populateSubjectDropdown();
        elements.addMcqModal.style.display = 'flex';
        currentQuestionsBatch = [];
        updateBatchCounter();
    });



    elements.closeModal.addEventListener('click', () => {
        // تنظيف أي أزرار تعديل متبقية
        const updateBtn = document.getElementById('updateMcqBtn');
        const cancelBtn = document.querySelector('.card-header .btn-danger');
        if (updateBtn) updateBtn.remove();
        if (cancelBtn) cancelBtn.remove();
        
        elements.addMcqModal.style.display = 'none';
        elements.addMcqBtn.style.display = 'block';
        elements.mcqForm.reset();
    });

    window.addEventListener('click', (e) => {
        if (e.target === elements.addMcqModal) {
            // تنظيف أي أزرار تعديل متبقية
            const updateBtn = document.getElementById('updateMcqBtn');
            const cancelBtn = document.querySelector('.card-header .btn-danger');
            if (updateBtn) updateBtn.remove();
            if (cancelBtn) cancelBtn.remove();
            
            elements.addMcqModal.style.display = 'none';
            elements.addMcqBtn.style.display = 'block';
            elements.mcqForm.reset();
        }
    });
    
    elements.mcqForm.addEventListener('submit', handleFormSubmit);
    elements.addAnotherBtn.addEventListener('click', handleAddAnother);
}

function populateSubjectDropdown() {
    elements.subjectSelect.innerHTML = '';
    
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        
        // تحديد المادة الحالية تلقائياً
        if (subject.id === currentSubjectId) {
            option.selected = true;
        }
        
        elements.subjectSelect.appendChild(option);
    });
}

function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 3000);
}

async function handleEdit(e) {
    const row = e.target.closest('tr');
    const mcqId = row.dataset.id;
    
    try {
        const mcqDoc = await getDoc(doc(db, "mcqs", mcqId));
        if (!mcqDoc.exists()) {
            showAlert("Question not found", "error");
            return;
        }
        
        const mcqData = mcqDoc.data();
        
        populateSubjectDropdown();
        document.getElementById('mcqQuestion').value = mcqData.question;
        document.getElementById('text_a').value = mcqData.options[0];
        document.getElementById('text_b').value = mcqData.options[1];
        document.getElementById('text_c').value = mcqData.options[2];
        document.getElementById('text_d').value = mcqData.options[3];
        
        const correctIndex = mcqData.options.indexOf(mcqData.correctAnswer);
        const correctOption = String.fromCharCode(97 + correctIndex);
        document.getElementById(`option_${correctOption}`).checked = true;
        
        // تحديد المادة في القائمة المنسدلة
        document.getElementById('mcqSubject').value = mcqData.subjectId;
        
        // تعبئة حقول tags و explanation الجديدة
        document.getElementById('mcqTags').value = mcqData.tags?.join(', ') || '';
        document.getElementById('mcqExplanation').value = mcqData.explanation || '';
        
        // تحديث التبويب النشط إذا لزم الأمر
        if (mcqData.subjectId !== currentSubjectId) {
            updateActiveTab(mcqData.subjectId);
        }
        
        const submitBtn = elements.mcqForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Update MCQ';
        
        elements.mcqForm.dataset.editingId = mcqId;
        elements.addMcqModal.style.display = 'flex';
        
    } catch (error) {
        console.error("Error editing MCQ:", error);
        showAlert("Error loading question for editing", "error");
    }
}
async function updateQuestion(mcqId) {
    const question = document.getElementById('mcqQuestion').value;
    const subjectId = document.getElementById('mcqSubject').value;
    const tags = document.getElementById('mcqTags').value.split(',').map(tag => tag.trim());
    const explanation = document.getElementById('mcqExplanation').value;
    
    const options = [
        document.getElementById('text_a').value,
        document.getElementById('text_b').value,
        document.getElementById('text_c').value,
        document.getElementById('text_d').value
    ];
    
    const correctOption = document.querySelector('input[name="correctOption"]:checked');
    if (!correctOption) {
        showAlert("Please select correct answer", "error");
        return;
    }
    
    const correctAnswer = options[correctOption.value.charCodeAt(0) - 97];
    
    try {
        await updateDoc(doc(db, "mcqs", mcqId), {
            question,
            options,
            correctAnswer,
            subjectId,
            tags, 
            explanation,  
            updatedAt: new Date(),
            subject: subjects.find(s => s.id === subjectId).name
              .toLowerCase()
              .replace(/\s+/g, '-')
        });
        
        showAlert("Question updated successfully", "success");
        await loadMCQs(subjectId);
        
    } catch (error) {
        console.error("Error updating MCQ:", error);
        showAlert("Error updating question", "error");
    }
}
function updateActiveTab(subjectId) {
    // تحديث المتغير العالمي
    currentSubjectId = subjectId;
    
    // تحديث واجهة المستخدم
    elements.currentSubjectTitle.textContent = `${subjects.find(s => s.id === subjectId)?.name} Questions`;
    
    // تحديث التبويبات
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.subjectId === subjectId);
    });
    
    // تحديث الجداول
    updateTableVisibility();
}
