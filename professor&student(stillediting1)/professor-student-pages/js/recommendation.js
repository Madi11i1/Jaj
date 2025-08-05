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
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadSubjects();
  } else {
    console.log("User is not authenticated");
    window.location.href = "/login.html";
  }
});

// DOM Elements
const elements = {
    tabsContainer: document.getElementById('subjectTabs'),
    recommendationForm: document.getElementById('recommendationForm'),
    subjectSelect: document.getElementById('recommendationSubject'),
    addRecommendationBtn: document.getElementById('addRecommendationBtn'),
    addRecommendationModal: document.getElementById('addRecommendationModal'),
    closeModal: document.querySelector('.close'),
    currentSubjectTitle: document.getElementById('currentSubjectTitle'),
    recommendationTablesContainer: document.getElementById('recommendationTablesContainer'),
    cardHeader: document.querySelector('.card-header')
};

// Global variables
let currentSubjectId = '';
let subjects = [];

async function initApp() {
    try {
        await loadSubjects();
        createSubjectTabs();
        createRecommendationTables();
        
        if (subjects.length > 0) {
            currentSubjectId = subjects[0].id;
            elements.currentSubjectTitle.textContent = `${subjects[0].name} Recommendations`;
            updateTableVisibility();
            await loadRecommendations(currentSubjectId);
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
            elements.currentSubjectTitle.textContent = `${subject.name} Recommendations`;
            updateTableVisibility();
            await loadRecommendations(currentSubjectId);
        });
        
        elements.tabsContainer.appendChild(tab);
    });
}

function createRecommendationTables() {
    elements.recommendationTablesContainer.innerHTML = '';
    
    subjects.forEach(subject => {
        const table = document.createElement('table');
        table.className = 'mcq-table';
        table.id = `table-${subject.id}`;
        table.style.display = 'none';
        
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Tags</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="recommendationTableBody-${subject.id}"></tbody>
        `;
        
        elements.recommendationTablesContainer.appendChild(table);
    });
}

function updateTableVisibility() {
    document.querySelectorAll('.mcq-table').forEach(table => {
        table.style.display = 'none';
    });
    
    if (currentSubjectId) {
        const currentTable = document.getElementById(`table-${currentSubjectId}`);
        if (currentTable) {
            currentTable.style.display = 'table';
        }
    }
}

async function loadRecommendations(subjectId) {
   try {
        console.log(`Loading Recommendations for subject: ${subjectId}`);
        const tbody = document.querySelector(`#recommendationTableBody-${subjectId}`);
        if (!tbody) {
            console.error(`Table body not found for subject: ${subjectId}`);
            return;
        }
        
        tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading...</td></tr>';
        
        const q = query(collection(db, "recommendations"), where("subjectId", "==", subjectId));
        const snapshot = await getDocs(q);
        
        console.log(`Found ${snapshot.size} recommendations for subject ${subjectId}`);
        
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-questions">No recommendations found</td></tr>';
            return;
        }
        
        let counter = 1;
        snapshot.forEach((doc) => {
            const recommendation = doc.data();
            const row = `
                <tr data-id="${doc.id}">
                    <td>${counter}</td>
                    <td>${recommendation.title || 'No title'}</td>
                    <td>${recommendation.type || 'No type'}</td>
                    <td>
                        ${recommendation.tags?.map(tag => `<span class="tag">${tag}</span>`).join('') || 'No tags'}
                    </td>
                    <td>
                        <button class="btn btn-primary btn-sm edit-btn">Edit</button>
                        <button class="btn btn-danger btn-sm delete-btn">Delete</button>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
            counter++;
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', handleDelete);
        });
        
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', handleEdit);
        });
        
    } catch (error) {
        console.error("Error loading Recommendations:", error);
        showAlert("Error loading recommendations", "error");
    }
}

async function handleDelete(e) {
    const row = e.target.closest('tr');
    const recommendationId = row.dataset.id;
    
    if (!confirm('Are you sure you want to delete this recommendation?')) return;
    
    try {
        await deleteDoc(doc(db, "recommendations", recommendationId));
        row.remove();
        showAlert("Recommendation deleted successfully", "success");
    } catch (error) {
        console.error("Error deleting recommendation:", error);
        showAlert("Error deleting recommendation", "error");
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const isEditing = elements.recommendationForm.dataset.editingId;
    
    if (isEditing) {
        await updateRecommendation(elements.recommendationForm.dataset.editingId);
        delete elements.recommendationForm.dataset.editingId;
        
        const cancelBtn = document.querySelector('.cancel-edit-btn');
        if (cancelBtn) cancelBtn.remove();
    } else {
        await saveRecommendation();
    }
    
    const submitBtn = elements.recommendationForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Save Recommendation';
    elements.addRecommendationModal.style.display = "none";
    elements.recommendationForm.reset();
}

async function saveRecommendation() {
    const title = document.getElementById('recommendationTitle').value;
    const content = document.getElementById('recommendationContent').value;
    
    // التعديل هنا: تغيير المتغير من resources إلى link
    const link = document.getElementById('recommendationResources').value;
    
const subjectId = currentSubjectId;
    const type = document.getElementById('recommendationType').value;
    const tags = document.getElementById('recommendationTags').value.split(',').map(tag => tag.trim());
    
    try {
        await addDoc(collection(db, "recommendations"), {
            title,
            content,
            link, // تغيير هنا: من resources إلى link
            subjectId,
            type,
            tags,
            createdAt: new Date()
        });
        
        showAlert("Recommendation added successfully", "success");
        await loadRecommendations(subjectId);
        
    } catch (error) {
        console.error("Error adding recommendation:", error);
        showAlert("Error adding recommendation", "error");
    }
}

function setupEventListeners() {
    elements.addRecommendationBtn.addEventListener('click', () => {
        elements.recommendationForm.reset();
        delete elements.recommendationForm.dataset.editingId;
        populateSubjectDropdown();
        elements.addRecommendationModal.style.display = 'flex';
        
        const cancelBtn = document.querySelector('.cancel-edit-btn');
        if (cancelBtn) cancelBtn.remove();
        
        const submitBtn = elements.recommendationForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Save Recommendation';
    });
    
    elements.recommendationForm.addEventListener('submit', handleFormSubmit);
    elements.closeModal.addEventListener('click', () => {
        elements.addRecommendationModal.style.display = 'none';
        elements.recommendationForm.reset();
        delete elements.recommendationForm.dataset.editingId;
        
        const cancelBtn = document.querySelector('.cancel-edit-btn');
        if (cancelBtn) cancelBtn.remove();
        
        const submitBtn = elements.recommendationForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Save Recommendation';
    });

    window.addEventListener('click', (e) => {
        if (e.target === elements.addRecommendationModal) {
            elements.addRecommendationModal.style.display = 'none';
            elements.recommendationForm.reset();
            delete elements.recommendationForm.dataset.editingId;
            
            const cancelBtn = document.querySelector('.cancel-edit-btn');
            if (cancelBtn) cancelBtn.remove();
            
            const submitBtn = elements.recommendationForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Save Recommendation';
        }
    });
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
    const recommendationId = row.dataset.id;
    
    try {
        const recommendationDoc = await getDoc(doc(db, "recommendations", recommendationId));
        if (!recommendationDoc.exists()) {
            showAlert("Recommendation not found", "error");
            return;
        }
        
        const recommendationData = recommendationDoc.data();
        const form = elements.recommendationForm;
        
        populateSubjectDropdown();
        form.querySelector('#recommendationTitle').value = recommendationData.title;
        form.querySelector('#recommendationContent').value = recommendationData.content;
        
        // استخدم querySelector على النموذج بدلاً من document
        const linkInput = form.querySelector('#recommendationResources');
        if (linkInput) {
            linkInput.value = recommendationData.link || recommendationData.resources || '';
        } else {
            console.error('Link input field not found in form');
        }
        
        form.querySelector('#recommendationSubject').value = recommendationData.subjectId;
        form.querySelector('#recommendationType').value = recommendationData.type || 'article';
        form.querySelector('#recommendationTags').value = recommendationData.tags?.join(', ') || '';
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Update Recommendation';
        
        form.dataset.editingId = recommendationId;
        elements.addRecommendationModal.style.display = 'flex';
        
        addCancelEditButton();
        
    } catch (error) {
        console.error("Error editing recommendation:", error);
        showAlert("Error loading recommendation for editing", "error");
    }
}
function addCancelEditButton() {
    if (document.querySelector('.cancel-edit-btn')) return;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-danger cancel-edit-btn';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel Edit';
    cancelBtn.style.marginLeft = '10px';
    
    cancelBtn.addEventListener('click', () => {
        elements.recommendationForm.reset();
        delete elements.recommendationForm.dataset.editingId;
        const submitBtn = elements.recommendationForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Save Recommendation';
        cancelBtn.remove();
        elements.addRecommendationModal.style.display = 'none';
    });
    
    elements.cardHeader.appendChild(cancelBtn);
}

async function updateRecommendation(recommendationId) {
    // استخدم elements بدلاً من document.getElementById
    const form = elements.recommendationForm;
    
    const title = form.querySelector('#recommendationTitle').value;
    const content = form.querySelector('#recommendationContent').value;
    const link = form.querySelector('#recommendationResources').value;
    const subjectId = currentSubjectId;
    const type = form.querySelector('#recommendationType').value;
    const tags = form.querySelector('#recommendationTags').value.split(',').map(tag => tag.trim());
    
    if (!title || !content || !subjectId || !type) {
        showAlert("Please fill all required fields", "error");
        return;
    }
    
    try {
        await updateDoc(doc(db, "recommendations", recommendationId), {
            title,
            content,
            link,
            subjectId,
            type,
            tags,
            updatedAt: new Date()
        });
        
        showAlert("Recommendation updated successfully", "success");
        await loadRecommendations(subjectId);
        
    } catch (error) {
        console.error("Error updating recommendation:", error);
        showAlert("Error updating recommendation", "error");
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    setupEventListeners();
});