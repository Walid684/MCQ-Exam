// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ----------------------------------------------------
// আপনার দেওয়া কনফিগারেশন বসানো হয়েছে
// ----------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBW0-UiTB83ikUOztrT6ECAkOlnzxykKYQ",
  authDomain: "mcq-exam-b150e.firebaseapp.com",
  projectId: "mcq-exam-b150e",
  storageBucket: "mcq-exam-b150e.firebasestorage.app",
  messagingSenderId: "751727102033",
  appId: "1:751727102033:web:35995f15619e300872d070",
  measurementId: "G-9NS51NRGER"
};

// আপনার অ্যাডমিন ইমেইল
const ADMIN_EMAIL = "mdwld2005@gmail.com"; 

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Global Variables
let currentQuestions = [];
let timerInterval;

// --- Helper: Loader Control ---
const toggleLoader = (show) => {
    const loader = document.getElementById('loader-overlay');
    if(loader) loader.style.display = show ? 'flex' : 'none';
};

// --- Helper: Navigation ---
window.showPage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    // Page specific loads
    if (pageId === 'profile-page') loadProfileStats();
    if (pageId === 'admin-page') loadAdminQuestions();
};

// --- 1. AUTHENTICATION LOGIC ---

// Animation Toggle
const signUpBtn = document.getElementById('signUp');
const signInBtn = document.getElementById('signIn');
const container = document.getElementById('container');

if(signUpBtn && signInBtn && container) {
    signUpBtn.addEventListener('click', () => container.classList.add("right-panel-active"));
    signInBtn.addEventListener('click', () => container.classList.remove("right-panel-active"));
}

// Sign Up
const signupForm = document.getElementById('signup-form');
if(signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        toggleLoader(true);
        const email = document.getElementById('signup-email').value;
        const pass = document.getElementById('signup-pass').value;
        const name = document.getElementById('signup-name').value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            // Save user data
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name: name,
                email: email,
                role: email === ADMIN_EMAIL ? "admin" : "student"
            });
            alert("অ্যাকাউন্ট তৈরি হয়েছে! আপনি লগইন অবস্থায় আছেন।");
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            toggleLoader(false);
        }
    });
}

// Login
const loginForm = document.getElementById('login-form');
if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        toggleLoader(true);
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            alert("Login Failed: " + error.message);
        } finally {
            toggleLoader(false);
        }
    });
}

// Google Login
const googleLoginBtn = document.getElementById('google-login');
if(googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error(error);
        }
    });
}

const googleSignupBtn = document.getElementById('google-signup');
if(googleSignupBtn) {
    googleSignupBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const result = await signInWithPopup(auth, googleProvider);
            // Ensure user doc exists
            const userRef = doc(db, "users", result.user.uid);
            const docSnap = await getDoc(userRef);
            if (!docSnap.exists()) {
                await setDoc(userRef, {
                    name: result.user.displayName,
                    email: result.user.email,
                    role: result.user.email === ADMIN_EMAIL ? "admin" : "student"
                });
            }
        } catch (error) {
            console.error(error);
        }
    });
}

// Log Out
window.logoutUser = () => {
    signOut(auth).then(() => {
        alert("লগ আউট সফল হয়েছে।");
        location.reload();
    });
};

// Auth State Monitor (Main Logic)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        toggleLoader(false); 

        // Get User Info
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const displayName = userData.name || user.displayName || "User";
            
            document.getElementById('user-display-name').innerText = displayName;
            document.getElementById('p-name').innerText = displayName;
            document.getElementById('p-email').innerText = user.email;

            // Admin Check
            if (user.email === ADMIN_EMAIL) {
                document.getElementById('admin-link').style.display = 'block';
            }
        }
    } else {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
        toggleLoader(false);
    }
});

// --- 2. EXAM SYSTEM ---

window.startExamSetup = async () => {
    showPage('exam-page');
    toggleLoader(true);
    const qContainer = document.getElementById('question-container');
    qContainer.innerHTML = '';
    
    const querySnapshot = await getDocs(collection(db, "questions"));
    currentQuestions = [];

    if (querySnapshot.empty) {
        qContainer.innerHTML = "<p>অ্যাডমিন এখনো কোনো প্রশ্ন যুক্ত করেননি।</p>";
        toggleLoader(false);
        return;
    }

    querySnapshot.forEach((doc, index) => {
        const data = doc.data();
        currentQuestions.push({ id: doc.id, ...data });
        
        const html = `
            <div class="mcq-box">
                <p><strong>${index + 1}. ${data.question}</strong></p>
                ${data.options.map((opt, i) => 
                    `<label style="display:block; margin:5px 0; cursor:pointer;">
                        <input type="radio" name="q_${doc.id}" value="${i+1}"> ${opt}
                    </label>`
                ).join('')}
            </div>
        `;
        qContainer.innerHTML += html;
    });

    // Start Timer (e.g. 10 minutes)
    let time = 600; 
    const timerDisplay = document.getElementById('timer');
    clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const min = Math.floor(time / 60);
        let sec = time % 60;
        sec = sec < 10 ? '0' + sec : sec;
        timerDisplay.innerText = `${min}:${sec}`;
        time--;
        
        if (time < 0) {
            clearInterval(timerInterval);
            alert("সময় শেষ!");
            window.submitExam();
        }
    }, 1000);
    
    toggleLoader(false);
};

window.submitExam = async () => {
    clearInterval(timerInterval);
    toggleLoader(true);
    let score = 0;
    
    currentQuestions.forEach(q => {
        const selected = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (selected && parseInt(selected.value) === q.correct) {
            score++;
        }
    });

    const user = auth.currentUser;
    try {
        await addDoc(collection(db, "results"), {
            userId: user.uid,
            score: score,
            total: currentQuestions.length,
            date: new Date().toLocaleDateString()
        });
        alert(`এক্সাম শেষ! আপনার স্কোর: ${score}/${currentQuestions.length}`);
        showPage('profile-page');
    } catch (e) {
        console.error(e);
        alert("রেজাল্ট সেভ করতে সমস্যা হয়েছে।");
    } finally {
        toggleLoader(false);
    }
};

// --- 3. ADMIN PANEL ---

window.addQuestion = async () => {
    // Security check inside function just in case
    if (auth.currentUser.email !== ADMIN_EMAIL) {
        return alert("Access Denied!");
    }

    const qText = document.getElementById('q-text').value;
    const op1 = document.getElementById('op1').value;
    const op2 = document.getElementById('op2').value;
    const op3 = document.getElementById('op3').value;
    const op4 = document.getElementById('op4').value;
    const correct = document.getElementById('correct-op').value;

    if (!qText || !correct) return alert("সব তথ্য পূরণ করুন");

    try {
        await addDoc(collection(db, "questions"), {
            question: qText,
            options: [op1, op2, op3, op4],
            correct: parseInt(correct)
        });
        alert("প্রশ্ন যুক্ত করা হয়েছে!");
        
        // Clear inputs
        document.getElementById('q-text').value = '';
        document.getElementById('op1').value = '';
        document.getElementById('op2').value = '';
        document.getElementById('op3').value = '';
        document.getElementById('op4').value = '';
        document.getElementById('correct-op').value = '';

        loadAdminQuestions();
    } catch (e) {
        alert("Error: " + e.message);
    }
};

window.loadAdminQuestions = async () => {
    const list = document.getElementById('admin-questions-list');
    list.innerHTML = "Loading...";
    const snapshot = await getDocs(collection(db, "questions"));
    list.innerHTML = "";
    
    if (snapshot.empty) {
        list.innerHTML = "No questions found.";
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        const div = document.createElement('div');
        div.className = "admin-item";
        div.innerHTML = `
            <span>${data.question}</span>
            <button onclick="deleteQuestion('${doc.id}')" style="background:red; width:auto; margin:0; padding:5px 10px;">Delete</button>
        `;
        list.appendChild(div);
    });
};

window.deleteQuestion = async (id) => {
    if(confirm("আপনি কি এই প্রশ্নটি ডিলিট করতে চান?")) {
        try {
            await deleteDoc(doc(db, "questions", id));
            loadAdminQuestions();
        } catch(e) {
            alert("Error: " + e.message);
        }
    }
};

// --- 4. PROFILE STATS ---

window.loadProfileStats = async () => {
    const user = auth.currentUser;
    const list = document.getElementById('score-list');
    
    // Create query
    const q = query(collection(db, "results"), where("userId", "==", user.uid));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        list.innerHTML = "আপনি এখনো কোনো এক্সাম দেননি।";
        return;
    }
    
    let html = "";
    snapshot.forEach(doc => {
        const d = doc.data();
        html += `<div style="padding:10px; border-bottom:1px solid #ddd; display:flex; justify-content:space-between;">
                    <span>${d.date}</span>
                    <span style="font-weight:bold; color:#FF4B2B;">${d.score}/${d.total}</span>
                 </div>`;
    });
    list.innerHTML = html;
};