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

// --- DOM Elements Helper ---
const el = (id) => document.getElementById(id);

// ==========================================
// ১. এই ফাংশনটি মিসিং ছিল, তাই এরর আসছিল
// ==========================================
window.navTo = (viewName) => {
    // সব ভিউ লুকিয়ে ফেলা
    document.querySelectorAll('.view').forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active-view');
    });

    // নির্দিষ্ট ভিউ দেখানো
    const target = document.getElementById('view-' + viewName);
    if(target) {
        target.style.display = 'block';
        target.classList.add('active-view');
    }

    // ন্যাভিগেশন বাটন কালার চেঞ্জ
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // ম্যানুয়ালি বাটন একটিভ করা
    if(viewName === 'home') document.querySelector('.bottom-nav .nav-item:nth-child(1)').classList.add('active');
    if(viewName === 'profile') document.querySelector('.bottom-nav .nav-item:nth-child(2)').classList.add('active');
    if(viewName === 'admin') {
        const adminBtn = document.getElementById('nav-admin');
        if(adminBtn) adminBtn.classList.add('active');
    }

    // পেজ লোড হলে ডাটা রিফ্রেশ
    if(viewName === 'home') loadExams();
    if(viewName === 'profile') loadHistory();
    if(viewName === 'admin') loadAdminData();
};

// --- ২. অথেনটিকেশন চেকার ---
onAuthStateChanged(auth, async (user) => {
    const loader = el('loader') || el('app-loader');
    
    if (user) {
        // লগইন সফল হলে
        if(el('auth-screen')) el('auth-screen').style.display = 'none';
        if(el('app-screen')) el('app-screen').style.display = 'block'; // 'flex' এর বদলে block দিলাম যাতে লেআউট না ভাঙ্গে
        
        try {
            // ডাটা আনা
            const userDoc = await getDoc(doc(db, "users", user.uid));
            let name = user.email.split('@')[0];
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                name = data.name || name;
                
                // অ্যাডমিন চেক
                if (data.role === 'admin' || user.email === ADMIN_EMAIL) {
                    if(el('nav-admin')) el('nav-admin').style.display = 'flex';
                }
            } else {
                // নতুন ইউজার ডাটা সেভ
                await setDoc(doc(db, "users", user.uid), {
                    name: user.displayName || name,
                    email: user.email,
                    role: user.email === ADMIN_EMAIL ? "admin" : "student"
                });
            }

            // UI আপডেট
            if(el('u-name')) el('u-name').innerText = name;
            if(el('p-name')) el('p-name').innerText = name;
            if(el('p-email')) el('p-email').innerText = user.email;
            
            loadExams(); // এক্সাম লোড

        } catch (e) {
            console.error(e);
        }
    } else {
        // লগ আউট হলে
        if(el('app-screen')) el('app-screen').style.display = 'none';
        if(el('auth-screen')) el('auth-screen').style.display = 'flex';
    }
    
    if(loader) loader.style.display = 'none';
});

// --- ৩. লগইন / সাইন আপ বাটন ---
window.handleLogin = async () => {
    const email = el('auth-email').value;
    const pass = el('auth-pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert("Login Failed: " + e.message); }
};

window.handleSignup = async () => {
    const email = el('auth-email').value;
    const pass = el('auth-pass').value;
    try {
        await createUserWithEmailAndPassword(auth, email, pass);
        alert("Account Created!");
    } catch (e) { alert("Signup Error: " + e.message); }
};

window.logoutUser = () => {
    signOut(auth).then(() => window.location.reload());
};

// --- ৪. এক্সাম এবং অ্যাডমিন ফাংশন ---

async function loadExams() {
    const list = el('exam-list-container') || el('exam-list');
    if(!list) return;

    list.innerHTML = '<p style="text-align:center">লোডিং...</p>';
    
    const snap = await getDocs(collection(db, "exams"));
    list.innerHTML = '';
    
    if (snap.empty) {
        list.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">কোনো এক্সাম নেই</p>';
        return;
    }

    snap.forEach(docSnap => {
        const d = docSnap.data();
        const div = document.createElement('div');
        div.className = 'exam-card'; // আপনার CSS এ এই ক্লাস থাকতে হবে
        // কার্ড ডিজাইন
        div.style = "background:white; padding:15px; margin-bottom:10px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;";
        
        div.innerHTML = `
            <div>
                <h4 style="margin:0;">${d.title}</h4>
                <small style="color:#777">${d.subject} • ${d.time} min</small>
            </div>
            <button onclick="startExam('${docSnap.id}', '${d.title}', ${d.time})" style="background:#6C63FF; color:white; border:none; padding:8px 15px; border-radius:5px;">Start</button>
        `;
        list.appendChild(div);
    });
}

// এক্সাম শুরু করা
window.startExam = async (id, title, time) => {
    navTo('exam'); // এক্সাম পেজে নিয়ে যাবে
    if(el('exam-subject')) el('exam-subject').innerText = title;
    
    const area = el('question-area') || el('questions-container');
    area.innerHTML = 'প্রশ্ন লোড হচ্ছে...';
    
    // প্রশ্ন লোড করা
    const q = query(collection(db, "questions"), where("examId", "==", id));
    const snap = await getDocs(q);
    
    area.innerHTML = '';
    window.currentQuestions = []; // গ্লোবাল ভেরিয়েবলে রাখা

    if(snap.empty) {
        area.innerHTML = "এই এক্সামে কোনো প্রশ্ন নেই।";
        return;
    }

    snap.forEach((doc, idx) => {
        const d = doc.data();
        window.currentQuestions.push({id: doc.id, ...d});
        
        area.innerHTML += `
            <div style="background:white; padding:15px; margin-bottom:15px; border-radius:10px;">
                <p><strong>${idx+1}. ${d.question}</strong></p>
                ${d.options.map((opt, i) => `
                    <label style="display:block; padding:8px; border:1px solid #eee; margin:5px 0; border-radius:5px;">
                        <input type="radio" name="q_${doc.id}" value="${i+1}"> ${opt}
                    </label>
                `).join('')}
            </div>
        `;
    });

    // টাইমার শুরু করা (সিম্পল)
    let timeLeft = time * 60;
    const timerEl = el('timer-display') || el('timer');
    
    if(window.examTimer) clearInterval(window.examTimer);
    
    window.examTimer = setInterval(() => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        if(timerEl) timerEl.innerText = `${m}:${s<10?'0'+s:s}`;
        timeLeft--;
        
        if(timeLeft < 0) {
            clearInterval(window.examTimer);
            alert("সময় শেষ!");
            submitExam();
        }
    }, 1000);
};

window.submitExam = async () => {
    if(window.examTimer) clearInterval(window.examTimer);
    
    let score = 0;
    window.currentQuestions.forEach(q => {
        const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if(sel && parseInt(sel.value) === q.correct) score++;
    });

    const user = auth.currentUser;
    await addDoc(collection(db, "results"), {
        userId: user.uid,
        score: score,
        total: window.currentQuestions.length,
        date: new Date().toLocaleDateString()
    });

    alert(`আপনার স্কোর: ${score} / ${window.currentQuestions.length}`);
    navTo('profile');
};

// হিস্ট্রি লোড
async function loadHistory() {
    const list = el('history-list');
    if(!list) return;
    
    const user = auth.currentUser;
    const q = query(collection(db, "results"), where("userId", "==", user.uid));
    const snap = await getDocs(q);
    
    list.innerHTML = '';
    snap.forEach(doc => {
        const d = doc.data();
        list.innerHTML += `
            <div style="background:white; padding:10px; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between;">
                <span>${d.date}</span>
                <b style="color:#6C63FF">${d.score}/${d.total}</b>
            </div>
        `;
    });
}

// অ্যাডমিন: নতুন এক্সাম
window.createNewExam = async () => {
    const title = el('new-exam-title').value;
    const sub = el('new-exam-subject').value;
    const time = el('new-exam-time').value;

    if(!title || !time) return alert("সব তথ্য দিন");

    await addDoc(collection(db, "exams"), {
        title: title,
        subject: sub,
        time: parseInt(time)
    });
    alert("এক্সাম তৈরি হয়েছে!");
    loadAdminData();
};

window.switchAdminTab = (tab) => {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active')); // CSS এ display:none থাকতে হবে
    document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
    
    const activeTab = document.getElementById('tab-' + tab);
    if(activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = 'block';
    }
};

async function loadAdminData() {
    const div = el('admin-exam-list');
    if(div) {
        const snap = await getDocs(collection(db, "exams"));
        div.innerHTML = '';
        snap.forEach(d => {
             div.innerHTML += `<p>${d.data().title}</p>`;
        });
    }
}
