import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- কনফিগারেশন ---
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

// --- ইনিশিয়ালাইজেশন ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- DOM Elements ---
const el = (id) => document.getElementById(id);

// --- টোস্ট মেসেজ (অ্যালার্টের বদলে) ---
const showToast = (msg, type = 'info') => {
    const box = el('toast-box');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = type === 'error' ? '#e74c3c' : '#2ecc71';
    toast.innerText = msg;
    box.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// --- অথেনটিকেশন স্টেট চেকার ---
onAuthStateChanged(auth, async (user) => {
    const loader = el('app-loader');
    
    if (user) {
        // লগইন সফল
        el('auth-screen').style.display = 'none';
        el('app-screen').style.display = 'flex';
        
        try {
            // ডাটা আনা
            const userDoc = await getDoc(doc(db, "users", user.uid));
            let name = user.email.split('@')[0];
            let role = "student";

            if (userDoc.exists()) {
                const data = userDoc.data();
                name = data.name || name;
                role = data.role || role;
            } else {
                // নতুন ইউজার ডাটা সেভ
                await setDoc(doc(db, "users", user.uid), {
                    name: user.displayName || name,
                    email: user.email,
                    role: user.email === ADMIN_EMAIL ? "admin" : "student"
                });
            }

            // UI আপডেট
            el('display-name').innerText = name;
            
            // অ্যাডমিন চেক
            if (user.email === ADMIN_EMAIL || role === 'admin') {
                el('admin-nav-item').style.display = 'block';
                loadAdminData(); // অ্যাডমিন ড্রপডাউন লোড
            }
            
            loadExams(); // এক্সাম লোড

        } catch (e) {
            console.error(e);
            showToast("Data Load Error", "error");
        }
    } else {
        // লগ আউট
        el('app-screen').style.display = 'none';
        el('auth-screen').style.display = 'flex';
    }
    
    // লোডার অফ
    if(loader) loader.style.display = 'none';
});

// --- ইভেন্ট লিসেনার (বাটন ক্লিক) ---

// ১. লগইন / সাইন আপ টগল
el('show-login-btn').addEventListener('click', () => {
    el('btn-bg').style.left = '5px';
    el('show-login-btn').classList.add('active');
    el('show-signup-btn').classList.remove('active');
    el('login-form').style.display = 'block';
    el('signup-form').style.display = 'none';
});

el('show-signup-btn').addEventListener('click', () => {
    el('btn-bg').style.left = '50%';
    el('show-signup-btn').classList.add('active');
    el('show-login-btn').classList.remove('active');
    el('login-form').style.display = 'none';
    el('signup-form').style.display = 'block';
});

// ২. লগইন সাবমিট
el('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = el('login-email').value;
    const pass = el('login-pass').value;
    
    try {
        el('app-loader').style.display = 'flex';
        await signInWithEmailAndPassword(auth, email, pass);
        showToast("Login Successful!");
    } catch (err) {
        el('app-loader').style.display = 'none';
        showToast(err.message, "error");
    }
});

// ৩. সাইন আপ সাবমিট
el('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = el('signup-email').value;
    const pass = el('signup-pass').value;
    const name = el('signup-name').value;
    
    try {
        el('app-loader').style.display = 'flex';
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        // নাম সেভ
        await setDoc(doc(db, "users", res.user.uid), {
            name: name,
            email: email,
            role: email === ADMIN_EMAIL ? "admin" : "student"
        });
        showToast("Account Created!");
    } catch (err) {
        el('app-loader').style.display = 'none';
        showToast(err.message, "error");
    }
});

// ৪. গুগল লগইন
el('google-login-btn').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (err) {
        showToast(err.message, "error");
    }
});

// ৫. লগ আউট
el('logout-btn').addEventListener('click', () => {
    signOut(auth);
    window.location.reload();
});

// ৬. বটম ন্যাভ লজিক
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        const targetId = item.getAttribute('data-target');
        el(targetId).classList.add('active');
        item.classList.add('active');
    });
});


// --- অ্যাপ ফাংশন (এক্সাম লোড, অ্যাডমিন) ---

async function loadExams() {
    const list = el('exam-list');
    list.innerHTML = '';
    
    const snap = await getDocs(collection(db, "exams"));
    if (snap.empty) {
        list.innerHTML = '<p style="text-align:center; color:#999;">কোনো এক্সাম নেই</p>';
        return;
    }

    snap.forEach(docSnap => {
        const d = docSnap.data();
        const div = document.createElement('div');
        div.className = 'exam-card';
        div.innerHTML = `
            <div>
                <h4 style="color:var(--dark)">${d.title}</h4>
                <small style="color:#777">${d.time} মিনিট</small>
            </div>
            <button class="submit-btn small" style="width:auto">Start</button>
        `;
        // স্টার্ট বাটন ক্লিক ইভেন্ট
        div.querySelector('button').addEventListener('click', () => startExam(docSnap.id, d.title, d.time));
        list.appendChild(div);
    });
}

// অ্যাডমিন: নতুন এক্সাম তৈরি
el('create-exam-btn').addEventListener('click', async () => {
    const title = el('admin-exam-title').value;
    const time = el('admin-exam-time').value;
    
    if(!title || !time) return showToast("সব তথ্য দিন", "error");
    
    try {
        await addDoc(collection(db, "exams"), { title, time: parseInt(time) });
        showToast("Exam Created!");
        loadExams();
        loadAdminData();
    } catch(e) { showToast(e.message, "error"); }
});

// অ্যাডমিন: বাল্ক আপলোড
el('upload-json-btn').addEventListener('click', async () => {
    const examId = el('admin-exam-select').value;
    const jsonStr = el('admin-json-input').value;
    
    if(!examId) return showToast("এক্সাম সিলেক্ট করুন", "error");
    
    try {
        const questions = JSON.parse(jsonStr);
        let count = 0;
        for(const q of questions) {
            await addDoc(collection(db, "questions"), {
                examId: examId,
                question: q.q,
                options: q.options,
                correct: q.correct
            });
            count++;
        }
        showToast(`${count} টি প্রশ্ন অ্যাড হয়েছে!`);
    } catch(e) { showToast("JSON Error: " + e.message, "error"); }
});

async function loadAdminData() {
    const sel = el('admin-exam-select');
    sel.innerHTML = '<option value="">Select Exam</option>';
    const snap = await getDocs(collection(db, "exams"));
    snap.forEach(d => {
        sel.innerHTML += `<option value="${d.id}">${d.data().title}</option>`;
    });
}

// এক্সাম লজিক (সাধারণ)
function startExam(id, title, time) {
    // এখানে এক্সাম শুরু করার কোড বসবে...
    // আপাতত জাস্ট ভিউ চেঞ্জ করছি
    showToast(`Exam Started: ${title}`);
}