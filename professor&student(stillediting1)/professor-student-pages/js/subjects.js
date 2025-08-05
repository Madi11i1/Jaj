import { db, app } from "./firebase-config.js"
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const subjectsCollection = collection(db, "subjects"); // تعريف المجموعة هنا
const auth = getAuth(app); // استخدام app المستوردة
let currentEditId = null;


onAuthStateChanged(auth, (user) => {
  if (user) {
    loadSubjects();
  } else {
    // Redirect to login or handle unauthorized access
    console.log("User is not authenticated");
    window.location.href = "/login.html";
  }
});

// 3. دالة تحميل وعرض المواد
async function loadSubjects() {
  try {
    const tbody = document.getElementById('subjectsTableBody');
    if (!tbody) {
      console.error("Element 'subjectsTableBody' not found");
      return;
    }
    
    tbody.innerHTML = '<tr><td colspan="3" class="loading">Loading subjects...</td></tr>';
    
    const querySnapshot = await getDocs(subjectsCollection);
    tbody.innerHTML = ''; // مسح المحتوى الحالي

    if (querySnapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="3">No subjects found</td></tr>';
      return;
    }

    querySnapshot.forEach((doc) => {
      const subject = doc.data();
      tbody.innerHTML += `
        <tr>
          <td>${subject.name}</td>
          <td>${subject.description}</td>
          <td>
            <button class="btn-edit" data-id="${doc.id}">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-delete" data-id="${doc.id}">
              <i class="fas fa-trash-alt"></i> Delete
            </button>
          </td>
        </tr>
      `;
    });
  } catch (error) {
    console.error("Error loading subjects:", error);
    const tbody = document.getElementById('subjectsTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="error">
            Error loading subjects. Please check your connection and try again.
            <button onclick="location.reload()">Retry</button>
          </td>
        </tr>
      `;
    }
  }
}

// 4. معالج حدث التعديل
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn-edit')) {
    const button = e.target.closest('.btn-edit');
    currentEditId = button.dataset.id;
    const row = button.closest('tr');
    
    // تعبئة النموذج بالبيانات الحالية
    document.getElementById('subjectName').value = row.cells[0].textContent;
    document.getElementById('subjectDesc').value = row.cells[1].textContent;
    
    // تغيير واجهة المودال
    document.getElementById('modalTitle').textContent = 'Edit Subject';
    document.getElementById('submitBtn').textContent = 'Save Update ';
    document.getElementById('addSubjectModal').style.display = 'block';
  }
});

// 5. معالج حدث الحفظ (للمواد الجديدة والتعديلات)
document.getElementById('addSubjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('subjectName').value.trim();
  const description = document.getElementById('subjectDesc').value.trim();
  
  if (!name || !description) {
    alert("الرجاء تعبئة جميع الحقول");
    return;
  }

  try {
    if (currentEditId) {
      // حالة التعديل
      await updateDoc(doc(db, "subjects", currentEditId), {
        name,
        description
      });
      alert("The subjects has been updated successfully");
    } else {
      // حالة الإضافة الجديدة
      await addDoc(subjectsCollection, {
        name,
        description
      });
      alert("subject added successfully ");
    }
    
    // إعادة التعيين وإغلاق النموذج
    currentEditId = null;
    document.getElementById('addSubjectModal').style.display = 'none';
    document.getElementById('addSubjectForm').reset();
    loadSubjects(); // إعادة تحميل الجدول
  } catch (error) {
    console.error("Error:", error);
    alert(` خطأ: ${error.message}`);
  }
});

// 6. معالج حدث الحذف
document.addEventListener('click', async (e) => {
  if (e.target.closest('.btn-delete')) {
    const button = e.target.closest('.btn-delete');
    const subjectId = button.dataset.id;
    const subjectName = button.closest('tr').cells[0].textContent;
    
    if (confirm(`Are you sure from delete "${subjectName}"؟`)) {
      try {
        await deleteDoc(doc(db, "subjects", subjectId));
        loadSubjects();
        alert("Deleted successfully");
      } catch (error) {
        console.error("Error deleting:", error);
        alert("حدث خطأ أثناء الحذف");
      }
    }
  }
});

// 7. تهيئة زر الإضافة الجديدة
document.getElementById('addSubjectBtn').addEventListener('click', () => {
  currentEditId = null;
  document.getElementById('addSubjectForm').reset();
  document.getElementById('modalTitle').textContent = 'Add new subjects';
  document.getElementById('submitBtn').textContent = 'Save';
  document.getElementById('addSubjectModal').style.display = 'block';
});

// 8. التحميل الأولي للمواد عند فتح الصفحة
loadSubjects();