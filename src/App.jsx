import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, getDocs, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';

// --- Configuration Firebase ---
// IMPORTANT : Assurez-vous que votre configuration Firebase est bien ici.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// --- Initialisation de Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Données du Quiz ---
const QUIZ_QUESTIONS = [
    // La première question utilise maintenant votre image
    { question: "Question 1", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse C", image: "/image/1000005159.jpg" },
    
    // Les autres questions utilisent toujours les images de remplacement
    { question: "Question 2", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse A", image: "https://placehold.co/600x400/120c1c/ffc600?text=Image+Q2" },
    { question: "Question 3", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse B", image: "https://placehold.co/600x400/120c1c/ffc600?text=Image+Q3" },
    { question: "Question 4", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse D", image: "https://placehold.co/600x400/120c1c/ffc600?text=Image+Q4" },
    { question: "Question 5", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse A", image: "https://placehold.co/600x400/120c1c/ffc600?text=Image+Q5" },
    { question: "Question 6", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse C", image: "https://placehold.co/600x400/120c1c/ffc600?text=Image+Q6" },
    { question: "Question 7", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse D", image: "https://placehold.co/600x400/120c1c/ffc600?text=Image+Q7" },
    { question: "Question 8", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse B", image: "https://placehold.co/600x400/120c1c/ffc600?text=Image+Q8" },
    { question: "Question 9", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse A", image: "https://placehold.co/600x400/120c1c/ffc600?text=Image+Q9" },
    { question: "Question 10", options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: "Réponse C", image: "https://placehold.co/600x400/120c1c/ffc600?text=Image+Q10" },
];

const TIME_PER_QUESTION = 20;
const TIME_FOR_ANSWER = 3;

// --- Composant Principal ---
export default function App() {
    const [gameState, setGameState] = useState({ view: 'login', questionIndex: -1, showResults: false });
    const [user, setUser] = useState({ pseudo: '', score: 0, totalTime: 0, id: '' });
    const [participants, setParticipants] = useState([]);
    const [timer, setTimer] = useState(TIME_PER_QUESTION);
    const [isAdmin, setIsAdmin] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const backgroundMusicRef = useRef(null);
    const resultsSoundRef = useRef(null);
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);
    const gameStateRef = useRef(gameState);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    const selectedAnswerRef = useRef(selectedAnswer);
    useEffect(() => { selectedAnswerRef.current = selectedAnswer; }, [selectedAnswer]);

    useEffect(() => {
        backgroundMusicRef.current = new Audio("/assets/background-music.mp3");
        backgroundMusicRef.current.loop = true;
        resultsSoundRef.current = new Audio("/assets/results-sound.mp3");
    }, []);

    useEffect(() => {
        const playMusic = async () => {
            try {
                if (gameState.view === 'quiz') {
                    resultsSoundRef.current.pause();
                    await backgroundMusicRef.current.play();
                } else if (gameState.showResults) {
                    backgroundMusicRef.current.pause();
                    resultsSoundRef.current.currentTime = 0;
                    await resultsSoundRef.current.play();
                } else {
                    backgroundMusicRef.current.pause();
                    resultsSoundRef.current.pause();
                }
            } catch (error) { console.log("La lecture audio a été bloquée par le navigateur."); }
        };
        playMusic();
    }, [gameState.view, gameState.showResults]);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, "quiz", "gameState"), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                const oldGameState = gameStateRef.current;
                const isNewQuestion = typeof oldGameState.questionIndex === 'number' && data.questionIndex > oldGameState.questionIndex;
                if (isLoggedIn && !isAdmin && isNewQuestion && selectedAnswerRef.current === null) {
                    handleNoAnswer();
                }
                setGameState(data);
                if (isNewQuestion || (data.questionIndex === 0 && oldGameState.questionIndex === -1)) {
                    setSelectedAnswer(null);
                }
            } else {
                setDoc(doc(db, "quiz", "gameState"), { view: 'login', questionIndex: -1, showResults: false });
            }
        });
        return () => unsubscribe();
    }, [isLoggedIn, isAdmin]);
    
    useEffect(() => {
        const q = query(collection(db, "participants"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const users = [];
            querySnapshot.forEach((doc) => { users.push({ id: doc.id, ...doc.data() }); });
            setParticipants(users);
        });
        return () => unsubscribe();
    }, []);

    // --- MOTEUR DE JEU CENTRALISÉ ET ROBUSTE ---
    useEffect(() => {
        if (!isAdmin) return;

        let timeoutId;

        if (gameState.view === 'quiz' && gameState.questionStartTime) {
            const startTime = gameState.questionStartTime.toDate();
            const remainingMs = (TIME_PER_QUESTION * 1000) - (new Date() - startTime);
            timeoutId = setTimeout(() => {
                updateDoc(doc(db, "quiz", "gameState"), { view: 'answer' });
            }, Math.max(0, remainingMs));
        } 
        else if (gameState.view === 'answer') {
            timeoutId = setTimeout(() => {
                const nextIndex = gameStateRef.current.questionIndex + 1;
                if (nextIndex < QUIZ_QUESTIONS.length) {
                    updateDoc(doc(db, "quiz", "gameState"), {
                        questionIndex: nextIndex,
                        view: 'quiz',
                        questionStartTime: serverTimestamp()
                    });
                } else {
                    updateDoc(doc(db, "quiz", "gameState"), { view: 'finished' });
                }
            }, TIME_FOR_ANSWER * 1000);
        }

        return () => clearTimeout(timeoutId);
    }, [isAdmin, gameState.view, gameState.questionStartTime]);

    // Met à jour l'affichage du minuteur pour tout le monde
    useEffect(() => {
        if (gameState.view === 'quiz' && gameState.questionStartTime) {
            const intervalId = setInterval(() => {
                const startTime = gameState.questionStartTime.toDate();
                const elapsed = Math.floor((new Date() - startTime) / 1000);
                setTimer(Math.max(0, TIME_PER_QUESTION - elapsed));
            }, 500);
            return () => clearInterval(intervalId);
        }
    }, [gameState.view, gameState.questionStartTime]);

    const handleNoAnswer = async () => {
        const scoreChange = -5;
        const userDocRef = doc(db, "participants", userRef.current.id);
        const newScore = userRef.current.score + scoreChange;
        await updateDoc(userDocRef, { score: newScore });
        setUser(prev => ({ ...prev, score: newScore }));
    };
    const handleLogin = async (pseudoInput) => {
        const pseudo = pseudoInput.trim();
        if (!pseudo) { alert("Veuillez entrer un pseudo."); return; }
        if (pseudo.toLowerCase() === 'admin') {
            setIsAdmin(true);
            setIsLoggedIn(true);
            return;
        }
        const participantsRef = collection(db, "participants");
        const q = query(participantsRef, where("pseudo", "==", pseudo));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            alert("Ce pseudo est déjà pris. Veuillez en choisir un autre.");
            return;
        }
        const userId = `${pseudo}-${Date.now()}`;
        const newUser = { pseudo, score: 0, totalTime: 0 };
        await setDoc(doc(db, "participants", userId), newUser);
        setUser({ ...newUser, id: userId });
        setIsLoggedIn(true);
        if (gameState.view === 'login') {
            await updateDoc(doc(db, "quiz", "gameState"), { view: 'waiting' });
        }
    };
    const handleStartQuiz = async () => {
        await setDoc(doc(db, "quiz", "gameState"), { view: 'quiz', questionIndex: 0, showResults: false, questionStartTime: serverTimestamp() });
    };
    const handleShowResults = async () => await updateDoc(doc(db, "quiz", "gameState"), { showResults: true });
    const handleResetQuiz = async () => {
        const participantsSnapshot = await getDocs(collection(db, "participants"));
        participantsSnapshot.forEach(p => { updateDoc(doc(db, "participants", p.id), { score: 0, totalTime: 0 }); });
        await setDoc(doc(db, "quiz", "gameState"), { view: 'login', questionIndex: -1, showResults: false });
    };
    const handleAnswer = async (answer) => {
        if (selectedAnswer) return;
        const currentQuestion = QUIZ_QUESTIONS[gameState.questionIndex];
        const timeTaken = TIME_PER_QUESTION - timer;
        setSelectedAnswer(answer);
        const scoreChange = (answer === currentQuestion.correct) ? 5 : -5;
        const userDocRef = doc(db, "participants", user.id);
        const newScore = user.score + scoreChange;
        const newTotalTime = user.totalTime + timeTaken;
        await updateDoc(userDocRef, { score: newScore, totalTime: newTotalTime });
        setUser(prev => ({ ...prev, score: newScore, totalTime: newTotalTime }));
    };

    const renderContent = () => {
        if (!isLoggedIn) return <LoginPanel onLogin={handleLogin} />;
        if (isAdmin) return <AdminPanel onStart={handleStartQuiz} onShowResults={handleShowResults} onReset={handleResetQuiz} participants={participants} gameState={gameState} />;
        if (gameState.showResults) return <ResultsPanel participants={participants} />;
        switch (gameState.view) {
            case 'quiz':
                if (gameState.questionIndex >= 0 && gameState.questionIndex < QUIZ_QUESTIONS.length) {
                    return <QuizPanel question={QUIZ_QUESTIONS[gameState.questionIndex]} onAnswer={handleAnswer} timer={timer} selectedAnswer={selectedAnswer} questionNumber={gameState.questionIndex + 1} totalQuestions={QUIZ_QUESTIONS.length} />;
                }
                break;
            case 'answer':
                if (gameState.questionIndex >= 0 && gameState.questionIndex < QUIZ_QUESTIONS.length) {
                    return <AnswerPanel question={QUIZ_QUESTIONS[gameState.questionIndex]} />;
                }
                break;
            case 'finished':
                 return <div className="text-center animate-fade-in-up"><h2 className="text-3xl font-bold mb-4 text-brand-teal">Quiz terminé !</h2><p className="text-lg text-gray-300">En attente de l'affichage des résultats...</p></div>;
            default:
                return <WaitingRoom participants={participants} />;
        }
    };

    return (
        <div className="text-white min-h-screen flex flex-col items-center justify-center font-sans p-4 overflow-hidden">
            {renderContent()}
        </div>
    );
}

// --- Composants d'UI ---

const LoginPanel = ({ onLogin }) => {
    const [pseudo, setPseudo] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); onLogin(pseudo); };
    return (
        <>
            <video autoPlay loop muted className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-20"><source src="/assets/intro-video.mp4" type="video/mp4" /></video>
            <div className="relative z-10 w-full max-w-2xl mx-auto bg-brand-purple/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-brand-light-purple/50 text-center animate-fade-in-up">
                <h1 className="text-4xl md:text-6xl font-extrabold text-center mb-3 text-white">Quiz<span className="text-brand-yellow">Show</span></h1>
                <p className="text-center text-gray-300 mb-10 text-lg">Préparez-vous à tester vos connaissances !</p>
                <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
                    <input type="text" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Votre pseudo" className="w-full max-w-sm p-4 bg-brand-dark/70 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-pink transition-all text-center text-xl font-semibold" />
                    <button type="submit" className="w-full max-w-sm bg-brand-pink hover:bg-opacity-80 text-white font-bold py-4 px-4 rounded-lg transition-transform transform hover:scale-105 shadow-lg text-xl">Rejoindre la partie</button>
                </form>
            </div>
        </>
    );
};

const QuizPanel = ({ question, onAnswer, timer, selectedAnswer, questionNumber, totalQuestions }) => {
    const getButtonClass = (option) => {
        if (!selectedAnswer) return "bg-brand-purple hover:bg-brand-light-purple border-brand-light-purple hover:border-brand-pink";
        if (option === selectedAnswer) return option === question.correct ? "bg-brand-teal border-green-300 scale-105 text-brand-dark" : "bg-brand-pink border-red-300 scale-105";
        return "bg-brand-purple/50 border-brand-light-purple/50 opacity-60 cursor-not-allowed";
    };
    return (
        <div className="w-full max-w-4xl mx-auto bg-brand-purple/60 backdrop-blur-lg rounded-2xl shadow-2xl p-6 md:p-8 border border-brand-light-purple/50 animate-fade-in-up">
            <ProgressBar current={questionNumber} total={totalQuestions} />
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-300">Question <span className="text-brand-yellow">{questionNumber}</span>/{totalQuestions}</h3>
                <div className={`text-3xl font-extrabold rounded-full w-16 h-16 flex items-center justify-center transition-all duration-300 ${timer <= 5 ? 'bg-brand-pink animate-pulse' : 'bg-brand-yellow text-brand-dark'}`}>{timer}</div>
            </div>
            <div className="my-6 h-48 md:h-64 flex justify-center items-center bg-brand-dark rounded-lg overflow-hidden">
                <img src={question.image} alt="Illustration" className="w-full h-full object-cover" />
            </div>
            <p className="text-2xl lg:text-3xl text-center font-bold mb-8 min-h-[6rem] flex items-center justify-center">{question.question}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {question.options.map(option => (
                    <button key={option} onClick={() => onAnswer(option)} disabled={!!selectedAnswer} className={`w-full p-4 rounded-lg text-lg font-semibold transition-all duration-300 border-2 ${getButtonClass(option)}`}>
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
};

const AnswerPanel = ({ question }) => (
    <div className="w-full max-w-4xl mx-auto bg-brand-purple/60 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-brand-light-purple/50 animate-fade-in-up text-center">
        <h2 className="text-2xl font-bold text-gray-300 mb-4">La bonne réponse était...</h2>
        <p className="text-4xl font-extrabold text-brand-yellow mb-6 bg-brand-dark/50 py-4 rounded-lg">{question.correct}</p>
        <p className="text-lg italic text-gray-300">"Si tu as répondu ça alors c'est bien, sinon c'est pas grave personne ne le saura jamais...:)"</p>
    </div>
);

const WaitingRoom = ({ participants, message }) => (
    <div className="w-full max-w-3xl mx-auto bg-brand-purple/60 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-brand-light-purple/50 text-center animate-fade-in-up">
        <h2 className="text-3xl font-bold mb-4 text-white">{message || "Salle d'attente"}</h2>
        <div className="flex items-center justify-center gap-3 mb-6 text-xl text-gray-300">
            <svg className="animate-spin h-6 w-6 text-brand-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span><strong className="text-brand-yellow">{participants.filter(p => p.pseudo.toLowerCase() !== 'admin').length}</strong> participant(s) connecté(s)</span>
        </div>
        <div className="flex flex-wrap justify-center gap-3 max-h-56 overflow-y-auto p-4 bg-brand-dark/50 rounded-lg">
            {participants.map(p => p.pseudo.toLowerCase() !== 'admin' && <span key={p.id} className="bg-brand-light-purple px-4 py-2 rounded-full text-base font-medium text-white">{p.pseudo}</span>)}
        </div>
    </div>
);

const ProgressBar = ({ current, total }) => {
    const percentage = (current / total) * 100;
    return (
        <div className="w-full bg-brand-dark rounded-full h-3 mb-4">
            <div className="bg-gradient-to-r from-brand-pink to-brand-yellow h-3 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
        </div>
    );
};

const ResultsPanel = ({ participants }) => {
    const sorted = [...participants].filter(p => p.pseudo.toLowerCase() !== 'admin').sort((a, b) => b.score - a.score);
    const fastest = [...participants].filter(p => p.pseudo.toLowerCase() !== 'admin' && p.score > 0).sort((a, b) => a.totalTime - b.totalTime)[0];
    const lowest = sorted[sorted.length - 1];
    return (
        <div className="w-full max-w-4xl mx-auto bg-brand-purple/60 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-brand-light-purple/50 text-center animate-fade-in-up space-y-6">
            <h2 className="text-5xl font-extrabold text-brand-yellow mb-6">Résultats Finaux</h2>
            {sorted.length > 0 && (
                <div className="bg-gradient-to-br from-brand-yellow to-orange-400 p-6 rounded-lg shadow-lg border-2 border-yellow-300/50 transform scale-105 animate-glow">
                    <p className="text-2xl font-bold text-brand-dark">🏆 LE GAGNANT 🏆</p>
                    <p className="text-5xl font-black text-white drop-shadow-md my-2">{sorted[0].pseudo}</p>
                    <p className="text-3xl font-bold text-brand-dark">{sorted[0].score} points !</p>
                </div>
            )}
            <div className="grid md:grid-cols-2 gap-4 pt-4">
                {fastest && (
                    <div className="bg-brand-light-purple/50 p-4 rounded-lg">
                        <p className="text-lg text-brand-teal font-bold">⚡️ Le plus rapide</p>
                        <p className="text-2xl font-bold">{fastest.pseudo}</p>
                        <p className="italic text-gray-400 text-sm">"C'était bien la peine d'aller si vite pour finir avec {fastest.score} points !"</p>
                    </div>
                )}
                {lowest && sorted.length > 1 && (
                    <div className="bg-red-900/50 p-4 rounded-lg">
                        <p className="text-lg text-red-300 font-bold">🤫 Le score le plus bas...</p>
                        <p className="text-gray-400">On ne donnera pas de nom, mais il est de <strong className="text-2xl font-bold text-red-300">{lowest.score}</strong> points.</p>
                    </div>
                )}
            </div>
            <h3 className="text-2xl font-bold pt-4">Classement Général</h3>
            <ol className="text-left space-y-2">
                {sorted.slice(1, 5).map((p, index) => (
                    <li key={p.id} className="bg-brand-light-purple/50 p-3 rounded-lg flex justify-between items-center text-lg">
                        <span><strong className="text-gray-400 font-bold mr-3">{index + 2}.</strong>{p.pseudo}</span>
                        <span className="font-bold text-brand-yellow">{p.score} pts</span>
                    </li>
                ))}
            </ol>
        </div>
    );
};

const AdminPanel = ({ onStart, onShowResults, onReset, participants, gameState }) => (
    <div className="w-full max-w-3xl mx-auto bg-brand-purple/60 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-brand-light-purple/50 text-center animate-fade-in-up">
        <h2 className="text-3xl font-bold mb-6 text-brand-teal">Panneau Administrateur</h2>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-8">
            {gameState.view !== 'quiz' && gameState.view !== 'finished' && gameState.view !== 'answer' && (
                <button onClick={onStart} className="bg-brand-teal hover:opacity-80 text-brand-dark font-bold py-4 px-8 text-xl rounded-lg shadow-lg transition-transform transform hover:scale-105">Lancer le Quiz</button>
            )}
            {gameState.view === 'finished' && !gameState.showResults && (
                <button onClick={onShowResults} className="bg-brand-yellow hover:opacity-80 text-brand-dark font-bold py-4 px-8 text-xl rounded-lg shadow-lg transition-transform transform hover:scale-105">Afficher les Résultats</button>
            )}
            <button onClick={onReset} className="bg-brand-pink hover:opacity-80 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105">Réinitialiser</button>
        </div>
        <WaitingRoom participants={participants} message="Participants" />
    </div>
);
