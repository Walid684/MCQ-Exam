console.log("Script Loaded Successfully");
alert("Script Loaded!"); 
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBW0-UiTB83ikUOztrT6ECAkOlnzxykKYQ",
  authDomain: "mcq-exam-b150e.firebaseapp.com",
  projectId: "mcq-exam-b150e",
  storageBucket: "mcq-exam-b150e.firebasestorage.app",
  messagingSenderId: "751727102033",
  appId: "1:751727102033:web:35995f15619e300872d070",
  measurementId: "G-9NS51NRGER"
};

const ADMIN_EMAIL = "mdwld2005@gmail.com"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let currentExamId = null;
let currentExamQuestions = [];
let timerInterval;

// --- UTILS ---
const loader = (show) => document.getElementById('loader').style.display = show ? 'flex' : 'none';

window.navTo = (viewName) => {
    document.getElementById('page-title').innerText = viewName.toUpperCase();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById(`view-${viewName}`).classList.add('active-view');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Simple nav highlight logic
    if(viewName === 'home') document.querySelector('.bottom-nav .nav-item:nth-child(1)').classList.add('active');
    if(viewName === 'profile') document.querySelector('.bottom-nav .nav-item:nth-child(2)').classList.add('active');
    if(viewName === 'admin') document.querySelector('#nav-admin').classList.add('active');
    
    if(viewName === 'home') loadExamList();
};

window.switchAdminTab = (tab) => {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
};

// --- AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-screen').classList.remove('active-screen');
        document.getElementById('app-screen').classList.add('active-screen');
        
        // Get User Data
        const snap = await getDoc(doc(db, "users", user.uid));
        const userData = snap.exists() ? snap.data() : { name: user.email };
        
        document.getElementById('u-name').innerText = userData.name;
        document.getElementById('p-name').innerText = userData.name;
        document.getElementById('p-email').innerText = user.email;

        if (user.email === ADMIN_EMAIL) {
            document.getElementById('nav-admin').style.display = 'flex';
            loadAdminExamList(); // For Bulk Import Dropdown
            loadAdminManageList();
        }
        loadExamList();
        loadHistory();
    } else {
        document.getElementById('auth-screen').classList.add('active-screen');
        document.getElementById('app-screen').classList.remove('active-screen');
    }
});

window.handleLogin = async () => {
    loader(true);
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('auth-email').value, document.getElementById('auth-pass').value);
    } catch(e) { alert(e.message); }
    loader(false);
};

window.handleSignup = async () => {
    loader(true);
    try {
        const email = document.getElementById('auth-email').value;
        const res = await createUserWithEmailAndPassword(auth, email, document.getElementById('auth-pass').value);
        await setDoc(doc(db, "users", res.user.uid), { name: email.split('@')[0], email: email });
    } catch(e) { alert(e.message); }
    loader(false);
};

document.getElementById('google-btn').addEventListener('click', async () => {
    try { await signInWithPopup(auth, googleProvider); } catch(e) { console.log(e); }
});

window.logoutUser = () => signOut(auth).then(()=>location.reload());


// --- STUDENT FEATURES ---

// 1. Load available exams
async function loadExamList() {
    const container = document.getElementById('exam-list-container');
    container.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    
    const snap = await getDocs(collection(db, "exams"));
    container.innerHTML = '';
    
    if(snap.empty) { container.innerHTML = '<p style="text-align:center">No exams found.</p>'; return; }

    snap.forEach(doc => {
        const exam = doc.data();
        container.innerHTML += `
            <div class="exam-card">
                <div class="exam-info">
                    <h4>${exam.title}</h4>
                    <span>${exam.subject}</span>
                    <span>${exam.time} Mins</span>
                </div>
                <button class="start-btn-sm" onclick="startExam('${doc.id}', '${exam.title}', ${exam.time})">Start</button>
            </div>
        `;
    });
}

// 2. Start specific exam
window.startExam = async (examId, title, time) => {
    currentExamId = examId;
    navTo('exam');
    document.getElementById('exam-subject').innerText = title;
    
    const qArea = document.getElementById('question-area');
    qArea.innerHTML = '<div class="spinner"></div>';
    
    // Fetch questions for this exam
    const q = query(collection(db, "questions"), where("examId", "==", examId));
    const snap = await getDocs(q);
    currentExamQuestions = [];
    
    if(snap.empty) { qArea.innerHTML = "No questions in this exam yet."; return; }

    qArea.innerHTML = '';
    snap.forEach((doc, idx) => {
        const data = doc.data();
        currentExamQuestions.push({id: doc.id, ...data});
        qArea.innerHTML += `
            <div class="mcq-box">
                <p>${idx+1}. ${data.question}</p>
                ${data.options.map((opt, i) => `
                    <label class="option-label">
                        <input type="radio" name="q_${doc.id}" value="${i+1}"> ${opt}
                    </label>
                `).join('')}
            </div>
        `;
    });

    // Timer Logic
    let timeLeft = time * 60;
    const tDisplay = document.getElementById('timer-display');
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        tDisplay.innerText = `${m}:${s < 10 ? '0'+s : s}`;
        timeLeft--;
        if(timeLeft < 0) {
            clearInterval(timerInterval);
            submitExam();
        }
    }, 1000);
};

// 3. Submit
window.submitExam = async () => {
    clearInterval(timerInterval);
    loader(true);
    let score = 0;
    
    currentExamQuestions.forEach(q => {
        const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if(sel && parseInt(sel.value) === q.correct) score++;
    });

    await addDoc(collection(db, "results"), {
        userId: auth.currentUser.uid,
        examId: currentExamId,
        examName: document.getElementById('exam-subject').innerText,
        score: score,
        total: currentExamQuestions.length,
        date: new Date().toLocaleDateString()
    });

    alert(`Result: ${score} / ${currentExamQuestions.length}`);
    loader(false);
    navTo('profile');
    loadHistory();
};

async function loadHistory() {
    const list = document.getElementById('history-list');
    const q = query(collection(db, "results"), where("userId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    
    list.innerHTML = snap.empty ? '<p style="text-align:center">No history.</p>' : '';
    snap.forEach(doc => {
        const d = doc.data();
        list.innerHTML += `
            <div class="history-item">
                <div>
                    <h4>${d.examName}</h4>
                    <small>${d.date}</small>
                </div>
                <h3 style="color:var(--primary)">${d.score}/${d.total}</h3>
            </div>
        `;
    });
}


// --- ADMIN FEATURES ---

// 1. Create Exam
window.createNewExam = async () => {
    const title = document.getElementById('new-exam-title').value;
    const sub = document.getElementById('new-exam-subject').value;
    const time = document.getElementById('new-exam-time').value;

    if(!title || !time) return alert("Fill all details");
    
    loader(true);
    await addDoc(collection(db, "exams"), {
        title: title,
        subject: sub,
        time: parseInt(time),
        createdAt: new Date()
    });
    alert("Exam Created!");
    loader(false);
    loadAdminExamList();
    loadAdminManageList();
};

// 2. Load Select Dropdown for Bulk Upload
async function loadAdminExamList() {
    const select = document.getElementById('bulk-exam-select');
    const snap = await getDocs(collection(db, "exams"));
    select.innerHTML = '<option value="">Select Exam First</option>';
    snap.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.data().title}</option>`;
    });
}

// 3. Load List to Manage (Delete)
async function loadAdminManageList() {
    const div = document.getElementById('admin-exam-list');
    const snap = await getDocs(collection(db, "exams"));
    div.innerHTML = '';
    snap.forEach(doc => {
        div.innerHTML += `
            <div class="exam-card">
                <span>${doc.data().title}</span>
                <button onclick="deleteExam('${doc.id}')" style="background:red; color:white; border:none; padding:5px; border-radius:5px;">Del</button>
            </div>`;
    });
}

window.deleteExam = async (id) => {
    if(confirm("Delete Exam? Questions will remain orphaned.")) {
        await deleteDoc(doc(db, "exams", id));
        loadAdminManageList();
        loadAdminExamList();
    }
}

// 4. BULK UPLOAD
window.fillSampleJson = () => {
    const sample = `[
  {
    "q": "বাংলাদেশের রাজধানী কোনটি?",
    "options": ["ঢাকা", "চট্টগ্রাম", "খুলনা", "সিলেট"],
    "correct": 1
  },
  {
    "q": "কম্পিউটারের মস্তিষ্ক কোনটি?",
    "options": ["RAM", "CPU", "HDD", "Mouse"],
    "correct": 2
  }
]`;
    document.getElementById('bulk-json').value = sample;
};

window.uploadBulkQuestions = async () => {
    const examId = document.getElementById('bulk-exam-select').value;
    const jsonText = document.getElementById('bulk-json').value;

    if(!examId) return alert("Please select an exam first!");
    
    try {
        const questions = JSON.parse(jsonText);
        if(!Array.isArray(questions)) throw new Error("Format invalid. Must be an array []");
        
        loader(true);
        let count = 0;
        
        // Batch upload logic (using loop for simplicity)
        for(const item of questions) {
            await addDoc(collection(db, "questions"), {
                examId: examId,
                question: item.q,
                options: item.options,
                correct: item.correct
            });
            count++;
        }
        
        alert(`${count} questions added successfully!`);
        document.getElementById('bulk-json').value = '';
    } catch(e) {
        alert("JSON Error: " + e.message);
    } finally {
        loader(false);
    }
};
