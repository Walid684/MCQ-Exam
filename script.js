// --- DEBUG MODE SCRIPT ---
// যদি কোনো এরর হয়, স্ক্রিনে দেখাবে
try {
    console.log("Starting Script...");
} catch (e) {
    alert("Startup Error: " + e.message);
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// কনফিগারেশন
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

// অ্যাপ ইনিশিয়ালাইজ
let app, auth, db, googleProvider;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    // alert("Firebase Connected!"); // কানেকশন চেক
} catch (e) {
    alert("Firebase Error: " + e.message);
}

// --- DOM Elements ---
const getEl = (id) => document.getElementById(id);

// --- AUTH STATE CHANGE (প্রধান লজিক) ---
onAuthStateChanged(auth, async (user) => {
    const authScreen = getEl('auth-screen');
    const appScreen = getEl('app-screen');
    const loader = getEl('loader');

    if (user) {
        // লগইন সফল হলে
        if(loader) loader.style.display = 'none';
        if(authScreen) authScreen.style.display = 'none';
        if(appScreen) {
            appScreen.style.display = 'block';
            appScreen.classList.add('active-screen');
        }

        // ইউজার ডাটা লোড
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            let name = user.displayName || "User";
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                name = data.name;
                // Admin Check
                if (data.role === 'admin' || user.email === ADMIN_EMAIL) {
                    if(getEl('nav-admin')) getEl('nav-admin').style.display = 'flex';
                }
            }

            if(getEl('u-name')) getEl('u-name').innerText = name;
            if(getEl('p-name')) getEl('p-name').innerText = name;
            if(getEl('p-email')) getEl('p-email').innerText = user.email;
            
            // এক্সাম লিস্ট লোড
            loadExamList(); 

        } catch (error) {
            alert("Data Load Error: " + error.message);
        }

    } else {
        // লগ আউট হলে
        if(loader) loader.style.display = 'none';
        if(appScreen) appScreen.style.display = 'none';
        if(authScreen) authScreen.style.display = 'flex'; // বা block
    }
});

// --- BUTTON ACTIONS ---

// গ্লোবাল উইন্ডো ফাংশন হিসেবে সেট করা (যাতে HTML থেকে কল করা যায়)
window.handleLogin = async () => {
    const email = getEl('auth-email').value;
    const pass = getEl('auth-pass').value;
    if(!email || !pass) return alert("ইমেইল ও পাসওয়ার্ড দিন");

    try {
        getEl('loader').style.display = 'flex';
        await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged বাকি কাজ করবে
    } catch (e) {
        getEl('loader').style.display = 'none';
        alert("Login Error: " + e.message);
    }
};

window.handleSignup = async () => {
    const email = getEl('auth-email').value;
    const pass = getEl('auth-pass').value;
    if(!email || !pass) return alert("ইমেইল ও পাসওয়ার্ড দিন");

    try {
        getEl('loader').style.display = 'flex';
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        
        // নাম সেভ করা (যদি ইনপুট ফিল্ড থাকে, নতুবা ইমেইল থেকে)
        await setDoc(doc(db, "users", res.user.uid), {
            name: email.split('@')[0],
            email: email,
            role: email === ADMIN_EMAIL ? "admin" : "student"
        });
        
        alert("Account Created! Logging in...");
    } catch (e) {
        getEl('loader').style.display = 'none';
        alert("Signup Error: " + e.message);
    }
};

// Google Login
const gBtn = getEl('google-btn');
if(gBtn) {
    gBtn.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (e) {
            alert("Google Error: " + e.message);
        }
    });
}

window.logoutUser = () => signOut(auth).then(() => window.location.reload());


// --- APP FUNCTIONS ---
// (বাকি ফাংশনগুলো যেমন loadExamList, createNewExam নিচে থাকবে)

// Exam List Load
async function loadExamList() {
    const list = getEl('exam-list-container');
    if(!list) return;
    
    try {
        const snap = await getDocs(collection(db, "exams"));
        list.innerHTML = '';
        if(snap.empty) {
            list.innerHTML = '<p style="text-align:center; padding:20px;">কোনো এক্সাম নেই</p>';
            return;
        }
        snap.forEach(d => {
            const val = d.data();
            list.innerHTML += `
            <div class="exam-card">
                <div class="exam-info">
                    <h4>${val.title}</h4>
                    <span>${val.subject}</span>
                </div>
                <button class="start-btn-sm" onclick="alert('Exam Started!')">Start</button>
            </div>`;
        });
    } catch(e) {
        console.log("Exam Load Error: ", e);
    }
}
