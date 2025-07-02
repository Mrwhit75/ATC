import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, onSnapshot, collection, query, where, serverTimestamp } from 'firebase/firestore';

// Global variables for Firebase configuration (provided by Canvas environment)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfigRaw = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}'; // Get raw string
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app = null; // Initialize to null
let db = null;  // Initialize to null
let auth = null; // Initialize to null
let firebaseInitError = null; // Global variable to store Firebase init error

try {
    const parsedFirebaseConfig = JSON.parse(firebaseConfigRaw);
    if (Object.keys(parsedFirebaseConfig).length === 0) {
        console.warn("Firebase config is empty or invalid. Firebase will not be initialized.");
        firebaseInitError = "Firebase configuration is missing or invalid.";
    } else {
        app = initializeApp(parsedFirebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    }
} catch (error) {
    console.error("Failed to parse Firebase config or initialize Firebase:", error);
    firebaseInitError = `Firebase initialization error: ${error.message}`;
}

// --- Helper Functions for Firestore Paths ---
// These functions will only be called if 'db' is not null,
// so no need for explicit checks inside them.
const getUserDocRef = (userId, collectionName, docId) => {
    return doc(db, `artifacts/${appId}/users/${userId}/${collectionName}`, docId);
};

const getUserCollectionRef = (userId, collectionName) => {
    return collection(db, `artifacts/${appId}/users/${userId}/${collectionName}`);
};

const getPublicDocRef = (collectionName, docId) => {
    return doc(db, `artifacts/${appId}/public/data/${collectionName}`, docId);
};

const getPublicCollectionRef = (collectionName) => {
    return collection(db, `artifacts/${appId}/public/data/${collectionName}`);
};

// --- Main App Component ---
export default function App() {
    const [userType, setUserType] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [showProfileSetup, setShowProfileSetup] = useState(false);
    const [currentFirebaseError, setCurrentFirebaseError] = useState(firebaseInitError); // Use the global error

    // State for login
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loginError, setLoginError] = useState(''); // Corrected to useState for proper state management

    // State for employee features
    const [employeeName, setEmployeeName] = useState('User');
    const [ptoBalance, setPtoBalance] = useState(0);
    const [ptoRequests, setPtoRequests] = useState([]);
    const [showReportForm, setShowReportForm] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportType, setReportType] = useState('call_out');
    const [reportDate, setReportDate] = useState('');
    const [reportTime, setReportTime] = useState('');
    const [latenessDuration, setLatenessDuration] = useState('');
    const [earlyLeaveReason, setEarlyLeaveReason] = useState('');

    const [showPtoRequestForm, setShowPtoRequestForm] = useState(false);
    const [ptoStartDate, setPtoStartDate] = useState('');
    const [ptoEndDate, setPtoEndDate] = useState('');
    const [ptoLeaveType, setPtoLeaveType] = useState('vacation');
    const [ptoNotes, setPtoNotes] = useState('');
    const [weeklyAttendanceReceipt, setWeeklyAttendanceReceipt] = useState(null);

    // State for general UI feedback
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');

    // State for employer features
    const [allPtoRequests, setAllPtoRequests] = useState([]);
    const [recentNotifications, setRecentNotifications] = useState([]);
    const [employeeAttendanceSummary, setEmployeeAttendanceSummary] = useState({});
    const [allCompanyAttendance, setAllCompanyAttendance] = useState([]);
    const [employerReportDate, setEmployerReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [employerReportViewType, setEmployerReportViewType] = useState('all');
    const [showEmployerSettings, setShowEmployerSettings] = useState(false);

    // Profile setup states
    const [profileName, setProfileName] = useState('');
    const [profileRole, setProfileRole] = useState('');
    const [profileCompany, setProfileCompany] = useState('');
    const [profileTitle, setProfileTitle] = useState('');
    const [profileManager, setProfileManager] = useState('');

    // PTO Allocation Modal for Employer
    const [showPtoAllocationModal, setShowPtoAllocationModal] = useState(false);
    const [currentCallOutRecord, setCurrentCallOutRecord] = useState(null);
    const [isCallOutQualifiedForPto, setIsCallOutQualifiedForPto] = useState(false);
    const [allocatedCallOutPtoHours, setAllocatedCallOutPtoHours] = useState('');


    // --- Firebase Initialization and Authentication ---
    useEffect(() => {
        if (currentFirebaseError) {
            setIsAuthReady(true); // Still set auth ready to allow UI to render the error
            return;
        }

        if (!app || !db || !auth) {
            // This case should ideally be caught by currentFirebaseError, but as a fallback
            console.error("Firebase instances are null after initialization attempt.");
            setCurrentFirebaseError("Firebase services could not be loaded.");
            setIsAuthReady(true);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                setUserId(user.uid);
                console.log("Firebase user signed in:", user.uid);

                const userProfileRef = getUserDocRef(user.uid, 'profiles', 'data');
                try {
                    const userProfileSnap = await getDoc(userProfileRef);

                    if (userProfileSnap.exists() && userProfileSnap.data().type) {
                        const profileData = userProfileSnap.data();
                        setEmployeeName(profileData.name || 'User');
                        setUserType(profileData.type);
                        setPtoBalance(profileData.ptoBalance || 0);
                        setShowProfileSetup(false);
                    } else {
                        setUserType(null);
                        setShowProfileSetup(true);
                        setProfileName(userProfileSnap.exists() ? userProfileSnap.data().name || '' : '');
                    }
                } catch (profileError) {
                    console.error("Error fetching user profile:", profileError);
                    setCurrentFirebaseError(`Error loading profile: ${profileError.message}`);
                    // Fallback to showing profile setup if profile cannot be fetched
                    setUserType(null);
                    setShowProfileSetup(true);
                }


                // Listen for real-time updates to user's PTO requests
                // Ensure db is available before querying
                if (db) {
                    const q = query(getPublicCollectionRef('pto_requests'), where('requesterId', '==', user.uid));
                    onSnapshot(q, (snapshot) => {
                        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setPtoRequests(requests.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate()));
                    }, (error) => {
                        console.error("Error listening to PTO requests:", error);
                        setCurrentFirebaseError(`Error loading PTO requests: ${error.message}`);
                    });

                    // Fetch weekly attendance for the receipt
                    const today = new Date();
                    const dayOfWeek = today.getDay();
                    const startOfWeek = new Date(today);
                    startOfWeek.setDate(today.getDate() - dayOfWeek);
                    startOfWeek.setHours(0, 0, 0, 0);

                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(startOfWeek.getDate() + 6);
                    endOfWeek.setHours(23, 59, 59, 999);

                    const attendanceQuery = query(
                        getUserCollectionRef(user.uid, 'attendance'),
                        where('timestamp', '>=', startOfWeek),
                        where('timestamp', '<=', endOfWeek)
                    );

                    onSnapshot(attendanceQuery, (snapshot) => {
                        const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setWeeklyAttendanceReceipt(activities);
                    }, (error) => {
                        console.error("Error listening to attendance:", error);
                        setCurrentFirebaseError(`Error loading attendance: ${error.message}`);
                    });
                }


            } else {
                // If no user, try to sign in anonymously
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                        console.log("Signed in with custom token.");
                    } else {
                        await signInAnonymously(auth);
                        console.log("Signed in anonymously.");
                    }
                } catch (error) {
                    console.error("Firebase authentication failed:", error);
                    setCurrentFirebaseError(`Authentication failed: ${error.message}`);
                }
            }
            setIsAuthReady(true);
        });

        return () => unsubscribe();
    }, [currentFirebaseError]); // Depend on currentFirebaseError to re-evaluate if it changes


    // --- Employer Data Listeners ---
    useEffect(() => {
        if (!isAuthReady || !userId || userType !== 'management' || currentFirebaseError) return;

        if (db) { // Ensure db is available before setting up listeners
            // Listen for all PTO requests (for employer dashboard)
            const ptoQuery = query(getPublicCollectionRef('pto_requests'));
            const unsubscribePto = onSnapshot(ptoQuery, (snapshot) => {
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllPtoRequests(requests.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate()));
            }, (error) => {
                console.error("Error listening to all PTO requests:", error);
                setCurrentFirebaseError(`Error loading all PTO requests: ${error.message}`);
            });

            // Listen for all notifications (e.g., check-ins, call-outs)
            const notificationsQuery = query(getPublicCollectionRef('notifications'));
            const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
                const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRecentNotifications(notifications.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate()));
            }, (error) => {
                console.error("Error listening to notifications:", error);
                setCurrentFirebaseError(`Error loading notifications: ${error.message}`);
            });

            // Listen for attendance summaries (simplified for dashboard)
            const attendanceSummaryQuery = query(getPublicCollectionRef('attendance_summary')); // Placeholder
            const unsubscribeAttendance = onSnapshot(attendanceSummaryQuery, (snapshot) => {
                const summary = {};
                snapshot.docs.forEach(doc => {
                    summary[doc.id] = doc.data();
                });
                setEmployeeAttendanceSummary(summary);
            }, (error) => {
                console.error("Error listening to attendance summary:", error);
                setCurrentFirebaseError(`Error loading attendance summary: ${error.message}`);
            });

            return () => {
                unsubscribePto();
                unsubscribeNotifications();
                unsubscribeAttendance();
            };
        }
    }, [isAuthReady, userId, userType, currentFirebaseError]); // Re-run if auth state or user type changes

    // --- UI Confirmation Message Handler ---
    const showTemporaryConfirmation = (message) => {
        setConfirmationMessage(message);
        setShowConfirmation(true);
        setTimeout(() => {
            setShowConfirmation(false);
            setConfirmationMessage('');
        }, 3000); // Message disappears after 3 seconds
    };

    // --- Login Logic (Simulated) ---
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        if (currentFirebaseError || !auth) {
            setLoginError("App is not ready due to Firebase errors.");
            return;
        }

        let assumedUserType = null;
        let assumedName = '';

        if (username === 'employee1' && password === 'password') {
            assumedUserType = 'employee';
            assumedName = 'Alice Employee';
        } else if (username === 'manager1' && password === 'password') {
            assumedUserType = 'management';
            assumedName = 'Bob Manager';
        } else {
            setLoginError("Invalid username or password.");
            return;
        }

        // Simulate setting profile states for the setup screen
        setProfileName(assumedName);
        setProfileRole(assumedUserType);
        setProfileCompany('Acme Brews');
        if (assumedUserType === 'employee') {
            setProfileTitle('Brewer');
            setProfileManager('Bob Manager');
        } else if (assumedUserType === 'management') {
            setProfileTitle('Head Brewer');
            setProfileManager('CEO');
        }

        try {
            const userProfileRef = getUserDocRef(auth.currentUser.uid, 'profiles', 'data');
            const userProfileSnap = await getDoc(userProfileRef);
            if (!userProfileSnap.exists() || !userProfileSnap.data().type) {
                setShowProfileSetup(true);
            } else {
                // If profile exists and has a type, directly log in
                setUserType(userProfileSnap.data().type);
                setEmployeeName(userProfileSnap.data().name);
                showTemporaryConfirmation(`Logged in as ${userProfileSnap.data().name}!`);
            }
        } catch (error) {
            console.error("Error during login profile check:", error);
            setLoginError(`Login failed: ${error.message}`);
        }
    };

    // --- Profile Setup Submission ---
    const handleProfileSetupSubmit = async (e) => {
        e.preventDefault();
        if (!userId || currentFirebaseError || !db) {
            console.error("User ID or Firebase not available for profile setup.");
            showTemporaryConfirmation("Error: App not ready for profile setup.");
            return;
        }

        const userProfileRef = getUserDocRef(userId, 'profiles', 'data');
        const nameToSave = profileName;
        const roleToSave = profileRole;

        if (!nameToSave || !roleToSave || !profileCompany || !profileTitle || (roleToSave === 'employee' && !profileManager)) {
            showTemporaryConfirmation("Please fill in all required profile fields.");
            return;
        }

        try {
            await setDoc(userProfileRef, {
                name: nameToSave,
                type: roleToSave,
                employeeId: userId, // Using Firebase UID as employeeId for demo
                ptoBalance: roleToSave === 'employee' ? 80 : 0, // Only employees get PTO balance
                companyName: profileCompany,
                title: profileTitle,
                manager: roleToSave === 'employee' ? profileManager : 'N/A'
            }, { merge: true });

            setEmployeeName(nameToSave);
            setUserType(roleToSave);
            setShowProfileSetup(false); // Hide profile setup
            showTemporaryConfirmation("Profile setup complete!");
        } catch (error) {
            console.error("Error saving profile:", error);
            showTemporaryConfirmation(`Error saving profile: ${error.message}`);
        }
    };

    // --- Employee Report Submission (Call Out, Lateness, Early Leave) ---
    const handleReportSubmit = async (e) => {
        e.preventDefault();
        if (!userId || currentFirebaseError || !db) {
            showTemporaryConfirmation("Error: App not ready for reporting.");
            return;
        }

        const attendanceRef = getUserCollectionRef(userId, 'attendance');
        const notificationRef = getPublicCollectionRef('notifications');
        const userProfileRef = getUserDocRef(userId, 'profiles', 'data');

        try {
            const userProfileSnap = await getDoc(userProfileRef);
            const profileData = userProfileSnap.exists() ? userProfileSnap.data() : {};

            const reportData = {
                type: reportType,
                date: reportDate,
                time: reportTime, // Applicable for late/early leave
                reason: reportReason, // General reason for call out
                employeeId: userId,
                employeeName: profileData.name || employeeName,
                companyName: profileData.companyName || 'Acme Brews',
                title: profileData.title || 'Brewer',
                manager: profileData.manager || 'Bob Manager',
                timestamp: serverTimestamp(),
                ptoAllocated: false, // Default to false for new reports
                ptoHours: 0, // Default to 0 for new reports
                notificationHandled: false // To track if employer has reviewed it
            };

            if (reportType === 'late') {
                reportData.latenessDuration = latenessDuration;
            } else if (reportType === 'early_leave') {
                reportData.earlyLeaveReason = earlyLeaveReason;
            }

            const newDocRef = await addDoc(attendanceRef, reportData);

            await addDoc(notificationRef, {
                type: reportType,
                employeeId: userId,
                employeeName: profileData.name || employeeName,
                timestamp: serverTimestamp(),
                message: `Employee ${profileData.name || employeeName} reported ${reportType.replace('_', ' ')} for ${reportDate}. ` +
                         (reportType === 'late' ? `Duration: ${latenessDuration}.` : '') +
                         (reportType === 'early_leave' ? `Reason: ${earlyLeaveReason}.` : '') +
                         (reportType === 'call_out' ? `Reason: ${reportReason}.` : ''),
                attendanceRecordId: newDocRef.id // Link notification to attendance record
            });

            showTemporaryConfirmation(`Your ${reportType.replace('_', ' ')} report has been submitted.`);
            setShowReportForm(false);
            setReportReason('');
            setReportDate('');
            setReportTime('');
            setLatenessDuration('');
            setEarlyLeaveReason('');
        } catch (error) {
            console.error("Error submitting report:", error);
            showTemporaryConfirmation(`Error submitting report: ${error.message}`);
        }
    };

    const handlePtoRequestSubmit = async (e) => {
        e.preventDefault();
        if (!userId || currentFirebaseError || !db) {
            showTemporaryConfirmation("Error: App not ready for PTO requests.");
            return;
        }

        const ptoRequestRef = getPublicCollectionRef('pto_requests');
        const notificationRef = getPublicCollectionRef('notifications');
        const userProfileRef = getUserDocRef(userId, 'profiles', 'data');

        try {
            const userProfileSnap = await getDoc(userProfileRef);
            const profileData = userProfileSnap.exists() ? userProfileSnap.data() : {};

            await addDoc(ptoRequestRef, {
                requesterId: userId,
                requesterName: profileData.name || employeeName, // Include name for employer view
                startDate: ptoStartDate,
                endDate: ptoEndDate,
                leaveType: ptoLeaveType,
                notes: ptoNotes,
                status: 'pending', // Initial status
                createdAt: serverTimestamp()
            });

            await addDoc(notificationRef, {
                type: 'pto_request',
                employeeId: userId,
                employeeName: profileData.name || employeeName,
                timestamp: serverTimestamp(),
                message: `Employee ${profileData.name || employeeName} requested PTO from ${ptoStartDate} to ${ptoEndDate}.`
            });

            showTemporaryConfirmation("Your PTO request has been submitted for approval.");
            setShowPtoRequestForm(false);
            setPtoStartDate('');
            setPtoEndDate('');
            setPtoNotes('');
        } catch (error) {
            console.error("Error submitting PTO request:", error);
            showTemporaryConfirmation(`Error submitting PTO request: ${error.message}`);
        }
    };

    // --- Employer Actions ---
    const handlePtoApproval = async (requestId, status) => {
        if (!userId || userType !== 'management' || currentFirebaseError || !db) {
            showTemporaryConfirmation("Error: App not ready for PTO approval.");
            return;
        }
        const requestRef = getPublicDocRef('pto_requests', requestId);
        const notificationRef = getPublicCollectionRef('notifications');

        try {
            await updateDoc(requestRef, { status: status });

            await addDoc(notificationRef, {
                type: 'pto_status_update',
                employeeId: allPtoRequests.find(req => req.id === requestId)?.requesterId, // Notify the requester
                timestamp: serverTimestamp(),
                message: `PTO request for ${allPtoRequests.find(req => req.id === requestId)?.requesterName} has been ${status}.`
            });

            showTemporaryConfirmation(`PTO request ${requestId} ${status}.`);
        } catch (error) {
            console.error(`Error ${status} PTO request:`, error);
            showTemporaryConfirmation(`Error: Could not ${status} request: ${error.message}`);
        }
    };

    // --- Handle PTO Allocation for Call Out ---
    const openPtoAllocationModal = (notification) => {
        // Find the corresponding attendance record from the simulated data
        const record = allCompanyAttendance.find(rec => rec.id === notification.attendanceRecordId);
        if (record && record.type === 'call_out') {
            setCurrentCallOutRecord(record);
            setIsCallOutQualifiedForPto(record.ptoAllocated || false);
            setAllocatedCallOutPtoHours(record.ptoHours > 0 ? record.ptoHours.toString() : '8'); // Default to 8 hours
            setShowPtoAllocationModal(true);
        } else {
            showTemporaryConfirmation("Could not find call-out record details or it's not a call-out.");
        }
    };

    const handlePtoAllocationSubmit = async (e) => {
        e.preventDefault();
        if (!userId || userType !== 'management' || !currentCallOutRecord || currentFirebaseError || !db) {
            showTemporaryConfirmation("Error: App not ready for PTO allocation.");
            return;
        }

        // In a real app, you'd get the actual attendance record reference
        // For this simulation, we'll update the simulated data and show confirmation
        const updatedAttendance = allCompanyAttendance.map(rec => {
            if (rec.id === currentCallOutRecord.id) {
                return {
                    ...rec,
                    ptoAllocated: isCallOutQualifiedForPto,
                    ptoHours: isCallOutQualifiedForPto ? parseFloat(allocatedCallOutPtoHours) : 0
                };
            }
            return rec;
        });
        setAllCompanyAttendance(updatedAttendance); // Update simulated data

        // In a real Firestore implementation, you'd update the specific attendance document:
        // const attendanceDocRef = doc(db, `artifacts/${appId}/users/${currentCallOutRecord.employeeId}/attendance`, currentCallOutRecord.id);
        // try {
        //     await updateDoc(attendanceDocRef, {
        //         ptoAllocated: isCallOutQualifiedForPto,
        //         ptoHours: isCallOutQualifiedForPto ? parseFloat(allocatedCallOutPtoHours) : 0
        //     });
        // } catch (error) {
        //     console.error("Error updating attendance record for PTO allocation:", error);
        //     showTemporaryConfirmation(`Error updating attendance record: ${error.message}`);
        //     return;
        // }


        // Mark the notification as handled (this would be an update to the notification document in Firestore)
        const updatedNotifications = recentNotifications.map(notif => {
            if (notif.attendanceRecordId === currentCallOutRecord.id) {
                return { ...notif, notificationHandled: true };
            }
            return notif;
        });
        setRecentNotifications(updatedNotifications); // Update simulated notifications


        showTemporaryConfirmation(`PTO allocation for ${currentCallOutRecord.employeeName}'s call-out updated.`);
        setShowPtoAllocationModal(false);
        setCurrentCallOutRecord(null);
        setIsCallOutQualifiedForPto(false);
        setAllocatedCallOutPtoHours('');
    };


    // Filter attendance data based on selected date
    const filteredAttendance = allCompanyAttendance.filter(record => record.date === employerReportDate);

    // Group filtered attendance by employee for individual view
    const groupedAttendance = filteredAttendance.reduce((acc, record) => {
        if (!acc[record.employeeId]) {
            acc[record.employeeId] = {
                employeeName: record.employeeName,
                employeeId: record.employeeId,
                title: record.title,
                manager: record.manager,
                records: []
            };
        }
        acc[record.employeeId].records.push(record);
        return acc;
    }, {});

    // Word count for early leave reason
    const wordCount = earlyLeaveReason.trim().split(/\s+/).filter(Boolean).length;


    // --- Render Logic ---
    // Display Firebase initialization errors immediately
    if (currentFirebaseError) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-green-900 text-stone-100 p-4">
                <div className="bg-red-800 p-8 rounded-xl shadow-2xl text-center border border-red-600 max-w-md w-full">
                    <h1 className="text-3xl font-bold mb-4 text-red-300">Application Error</h1>
                    <p className="text-red-100 mb-4">
                        There was an issue initializing the application services.
                    </p>
                    <p className="text-red-200 text-sm italic">
                        Details: {currentFirebaseError}
                    </p>
                    <p className="mt-4 text-sm text-red-100">
                        Please try refreshing the page. If the problem persists, contact support.
                    </p>
                </div>
            </div>
        );
    }

    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-green-900 text-stone-100">
                <p>Loading A.T.C...</p>
            </div>
        );
    }

    // Login Screen
    if (!userType && !showProfileSetup) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-green-900 text-stone-100 p-4">
                <div className="bg-green-800 p-8 rounded-xl shadow-2xl text-center border border-amber-600 max-w-md w-full">
                    <img src="https://placehold.co/150x100/A0AEC0/000000?text=Punch+Card" alt="Punch Card" className="mx-auto mb-6 rounded-lg shadow-md" />
                    <h1 className="text-3xl font-bold mb-6 text-amber-400">Welcome to A.T.C (Automated Time Card)</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="username" className="sr-only">Username</label>
                            <input
                                type="text"
                                id="username"
                                placeholder="Username (e.g., employee1 or manager1)"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-green-900 leading-tight focus:outline-none focus:shadow-outline bg-stone-200"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="Password (e.g., password)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-green-900 leading-tight focus:outline-none focus:shadow-outline bg-stone-200"
                                required
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="flex items-center text-stone-100 text-sm">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="form-checkbox h-4 w-4 text-amber-600 transition duration-150 ease-in-out"
                                />
                                <span className="ml-2">Remember Me</span>
                            </label>
                            <button
                                type="submit"
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
                            >
                                Sign In
                            </button>
                        </div>
                        {loginError && <p className="text-red-400 text-sm mt-2">{loginError}</p>}
                    </form>
                </div>
            </div>
        );
    }

    // Profile Setup Screen
    if (showProfileSetup) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-green-900 text-stone-100 p-4">
                <div className="bg-green-800 p-8 rounded-xl shadow-2xl text-center border border-amber-600 max-w-md w-full">
                    <h1 className="text-3xl font-bold mb-6 text-amber-400">Set Up Your Profile</h1>
                    <img
                        src="https://placehold.co/100x100/A0AEC0/FFFFFF?text=Employee+Pic"
                        alt="Employee Placeholder"
                        className="mx-auto rounded-full mb-4 border-2 border-green-500"
                    />
                    <p className="text-stone-300 text-sm mb-4">*(Image upload coming soon!)*</p>
                    <form onSubmit={handleProfileSetupSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="profileName" className="block text-stone-300 text-sm font-bold mb-2 text-left">Your Name:</label>
                            <input
                                type="text"
                                id="profileName"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-green-900 leading-tight focus:outline-none focus:shadow-outline bg-stone-200"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="profileRole" className="block text-stone-300 text-sm font-bold mb-2 text-left">I am:</label>
                            <select
                                id="profileRole"
                                value={profileRole}
                                onChange={(e) => setProfileRole(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-green-900 leading-tight focus:outline-none focus:shadow-outline bg-stone-200"
                                required
                            >
                                <option value="">Select Role</option>
                                <option value="employee">Employee</option>
                                <option value="management">Management</option>
                            </select>
                        </div>
                        {/* Additional profile fields can be added here if needed for initial setup */}
                        <div>
                            <label htmlFor="profileCompany" className="block text-stone-300 text-sm font-bold mb-2 text-left">Company Name:</label>
                            <input
                                type="text"
                                id="profileCompany"
                                value={profileCompany}
                                onChange={(e) => setProfileCompany(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-green-900 leading-tight focus:outline-none focus:shadow-outline bg-stone-200"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="profileTitle" className="block text-stone-300 text-sm font-bold mb-2 text-left">Your Title:</label>
                            <input
                                type="text"
                                id="profileTitle"
                                value={profileTitle}
                                onChange={(e) => setProfileTitle(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-green-900 leading-tight focus:outline-none focus:shadow-outline bg-stone-200"
                                required
                            />
                        </div>
                        {profileRole === 'employee' && (
                            <div>
                                <label htmlFor="profileManager" className="block text-stone-300 text-sm font-bold mb-2 text-left">Your Direct Manager's Name:</label>
                                <input
                                    type="text"
                                    id="profileManager"
                                    value={profileManager}
                                    onChange={(e) => setProfileManager(e.target.value)}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-green-900 leading-tight focus:outline-none focus:shadow-outline bg-stone-200"
                                    required
                                />
                            </div>
                        )}
                        <button
                            type="submit"
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 w-full"
                        >
                            Save Profile
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-green-900 text-stone-100 flex flex-col items-center p-4">
            {/* Confirmation Message */}
            {showConfirmation && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white py-2 px-4 rounded-lg shadow-xl z-50 animate-bounce">
                    {confirmationMessage}
                </div>
            )}

            {/* Header */}
            <header className="w-full max-w-4xl bg-green-800 p-6 rounded-xl shadow-lg mt-4 mb-8 text-center border border-amber-600">
                <img src="https://placehold.co/150x100/A0AEC0/000000?text=Punch+Card" alt="Punch Card" className="mx-auto mb-4 rounded-lg shadow-md" />
                <h1 className="text-4xl font-extrabold text-amber-400 mb-2">
                    Welcome, {employeeName}!
                </h1>
                <p className="text-stone-300">You are logged in as: <span className="font-semibold">{userId}</span></p> {/* Display full userId */}
                <button
                    onClick={() => {
                        auth.signOut(); // Sign out Firebase user
                        setUserType(null); // Reset UI
                        setUsername('');
                        setPassword('');
                        setLoginError('');
                        setEmployeeName('User');
                        setPtoBalance(0);
                        setPtoRequests([]);
                        setAllPtoRequests([]);
                        setRecentNotifications([]);
                        setEmployeeAttendanceSummary({});
                        setAllCompanyAttendance([]); // Clear simulated data on logout
                        setShowProfileSetup(false); // Ensure profile setup is hidden
                        showTemporaryConfirmation("Logged out successfully!");
                    }}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-4 rounded-md shadow-md transition duration-300"
                >
                    Log Out
                </button>
            </header>

            {/* Employee View */}
            {userType === 'employee' && (
                <div className="w-full max-w-4xl space-y-8">
                    {/* Report Lateness / Early Leave / Call Out Block */}
                    <div className="bg-green-800 p-6 rounded-xl shadow-lg border border-amber-600 flex flex-col items-center justify-center text-center">
                        <h2 className="text-2xl font-bold text-amber-400 mb-4">Report Lateness / Leave Early / Call Out</h2>
                        {!showReportForm ? (
                            <button
                                onClick={() => setShowReportForm(true)}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300"
                                disabled={!userId}
                            >
                                Make a Report
                            </button>
                        ) : (
                            <form onSubmit={handleReportSubmit} className="space-y-4 w-full">
                                <div>
                                    <label htmlFor="reportType" className="block text-stone-300 text-sm font-bold mb-1">Report Type:</label>
                                    <select
                                        id="reportType"
                                        value={reportType}
                                        onChange={(e) => {
                                            setReportType(e.target.value);
                                            // Reset specific fields when type changes
                                            setLatenessDuration('');
                                            setEarlyLeaveReason('');
                                            setReportReason('');
                                        }}
                                        className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200"
                                    >
                                        <option value="call_out">Calling Out</option>
                                        <option value="late">Reporting Lateness</option>
                                        <option value="early_leave">Leaving Early</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="reportDate" className="block text-stone-300 text-sm font-bold mb-1">Date:</label>
                                    <input
                                        type="date"
                                        id="reportDate"
                                        value={reportDate}
                                        onChange={(e) => setReportDate(e.target.value)}
                                        className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200"
                                        required
                                    />
                                </div>
                                {reportType === 'late' && (
                                    <div>
                                        <label htmlFor="latenessDuration" className="block text-stone-300 text-sm font-bold mb-1">How late?</label>
                                        <select
                                            id="latenessDuration"
                                            value={latenessDuration}
                                            onChange={(e) => setLatenessDuration(e.target.value)}
                                            className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200"
                                            required
                                        >
                                            <option value="">Select duration</option>
                                            <option value="0-15min">0-15 minutes</option>
                                            <option value="20-30min">20-30 minutes</option>
                                            <option value="1hour+">1 hour or later</option>
                                        </select>
                                    </div>
                                )}
                                {(reportType === 'call_out' || reportType === 'late') && (
                                    <div>
                                        <label htmlFor="reportReason" className="block text-stone-300 text-sm font-bold mb-1">Reason:</label>
                                        <textarea
                                            id="reportReason"
                                            value={reportReason}
                                            onChange={(e) => setReportReason(e.target.value)}
                                            rows="2"
                                            className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200"
                                            required={reportType === 'call_out'} // Only required for call out
                                        ></textarea>
                                    </div>
                                )}
                                {reportType === 'early_leave' && (
                                    <div>
                                        <label htmlFor="earlyLeaveReason" className="block text-stone-300 text-sm font-bold mb-1">Reason for early leave (20 words max):</label>
                                        <textarea
                                            id="earlyLeaveReason"
                                            value={earlyLeaveReason}
                                            onChange={(e) => {
                                                const words = e.target.value.split(/\s+/).filter(Boolean);
                                                if (words.length <= 20) {
                                                    setEarlyLeaveReason(e.target.value);
                                                } else {
                                                    showTemporaryConfirmation("Reason limited to 20 words.");
                                                }
                                            }}
                                            rows="2"
                                            className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200"
                                            required
                                        ></textarea>
                                        <p className="text-xs text-stone-400 text-right">{wordCount}/20 words</p>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="reportTime" className="block text-stone-300 text-sm font-bold mb-1">Time (if applicable):</label>
                                    <input
                                        type="time"
                                        id="reportTime"
                                        value={reportTime}
                                        onChange={(e) => setReportTime(e.target.value)}
                                        className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200"
                                    />
                                </div>
                                <div className="flex space-x-2">
                                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg flex-grow">Submit</button>
                                    <button type="button" onClick={() => setShowReportForm(false)} className="bg-stone-500 hover:bg-stone-600 text-white font-bold py-2 px-3 rounded-lg">Cancel</button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Request PTO Block */}
                    <div className="bg-green-800 p-6 rounded-xl shadow-lg border border-green-600 flex flex-col items-center justify-center text-center">
                        <h2 className="text-2xl font-bold text-green-400 mb-4">Request PTO</h2>
                        <p className="text-lg mb-4">Balance: <span className="font-semibold text-lime-400">{ptoBalance} hours</span></p>
                        {!showPtoRequestForm ? (
                            <button
                                onClick={() => setShowPtoRequestForm(true)}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300"
                                disabled={!userId}
                            >
                                Submit Request
                            </button>
                        ) : (
                            <form onSubmit={handlePtoRequestSubmit} className="space-y-4 w-full">
                                <div>
                                    <label htmlFor="ptoStartDate" className="block text-stone-300 text-sm font-bold mb-1">Start Date:</label>
                                    <input type="date" id="ptoStartDate" value={ptoStartDate} onChange={(e) => setPtoStartDate(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200" required />
                                </div>
                                <div>
                                    <label htmlFor="ptoEndDate" className="block text-stone-300 text-sm font-bold mb-1">End Date:</label>
                                    <input type="date" id="ptoEndDate" value={ptoEndDate} onChange={(e) => setPtoEndDate(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200" required />
                                </div>
                                <div>
                                    <label htmlFor="ptoLeaveType" className="block text-stone-300 text-sm font-bold mb-1">Type:</label>
                                    <select id="ptoLeaveType" value={ptoLeaveType} onChange={(e) => setPtoLeaveType(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200">
                                        <option value="vacation">Vacation</option>
                                        <option value="sick">Sick Leave</option>
                                        <option value="personal">Personal Day</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="ptoNotes" className="block text-stone-300 text-sm font-bold mb-1">Notes (Optional):</label>
                                    <textarea id="ptoNotes" value={ptoNotes} onChange={(e) => setPtoNotes(e.target.value)} rows="1" className="shadow border rounded w-full py-2 px-3 text-green-900 bg-stone-200"></textarea>
                                </div>
                                <div className="flex space-x-2">
                                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg flex-grow">Submit</button>
                                    <button type="button" onClick={() => setShowPtoRequestForm(false)} className="bg-stone-500 hover:bg-stone-600 text-white font-bold py-2 px-3 rounded-lg">Cancel</button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* PTO Request List */}
                    <div className="bg-green-800 p-6 rounded-xl shadow-lg border border-green-600">
                        <h3 className="text-xl font-bold text-green-300 mb-4">Your PTO Requests:</h3>
                        {ptoRequests.length === 0 ? (
                            <p className="text-stone-300">No PTO requests submitted yet.</p>
                        ) : (
                            <ul className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                {ptoRequests.map(req => (
                                    <li key={req.id} className="bg-green-700 p-4 rounded-lg shadow-md flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-lg">{req.leaveType} from {req.startDate} to {req.endDate}</p>
                                            <p className="text-sm text-stone-300">Status: <span className={`font-bold ${req.status === 'pending' ? 'text-amber-300' : req.status === 'approved' ? 'text-lime-300' : 'text-red-300'}`}>{req.status}</span></p>
                                            {req.notes && <p className="text-sm text-stone-300 italic">Notes: {req.notes}</p>}
                                        </div>
                                        <p className="text-xs text-stone-400">Requested: {req.createdAt?.toDate().toLocaleDateString()}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Weekly Attendance Receipt */}
                    <div className="bg-green-800 p-6 rounded-xl shadow-lg border border-green-600">
                        <h2 className="text-2xl font-bold text-green-400 mb-4">Weekly Attendance Receipt</h2>
                        {weeklyAttendanceReceipt && weeklyAttendanceReceipt.length > 0 ? (
                            <div className="bg-stone-100 text-green-900 p-6 rounded-lg shadow-inner font-mono text-sm max-w-md mx-auto">
                                <div className="text-center mb-4">
                                    <p className="text-lg font-bold">--- A.T.C Time Report ---</p>
                                    <p className="text-xs">Acme Brews</p>
                                    <p className="text-xs">Employee: {employeeName} (ID: {userId})</p>
                                    <p className="text-xs">Week of: {new Date(weeklyAttendanceReceipt[0].timestamp?.toDate()).toLocaleDateString()} - {new Date().toLocaleDateString()}</p>
                                    <p className="mt-2">--------------------------------</p>
                                </div>
                                <ul className="space-y-1 mb-4">
                                    {weeklyAttendanceReceipt.map(activity => (
                                        <li key={activity.id} className="flex justify-between">
                                            <span className="flex-grow">{activity.date} {activity.time || ''}</span>
                                            <span className="font-semibold text-right">
                                                {activity.type.replace(/_/g, ' ').toUpperCase()}
                                                {activity.type === 'call_out' && activity.ptoAllocated && activity.ptoHours > 0 &&
                                                    <span className="text-lime-600 font-bold ml-2"> (+{activity.ptoHours} PTO Hrs)</span>
                                                }
                                                {activity.type === 'late' && activity.latenessDuration &&
                                                    <span className="text-amber-600 ml-2"> ({activity.latenessDuration})</span>
                                                }
                                                {activity.type === 'early_leave' && activity.earlyLeaveReason &&
                                                    <span className="text-red-600 ml-2"> (Left early: {activity.earlyLeaveReason.split(/\s+/).slice(0, 5).join(' ')}...)</span>
                                                }
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="text-center mt-4">
                                    <p>--------------------------------</p>
                                    <p className="text-lg font-bold mt-2">PTO Utilized This Week:</p>
                                    {/* Filter PTO activities from the weekly receipt */}
                                    {weeklyAttendanceReceipt.filter(act => act.type.includes('pto') || (act.type === 'call_out' && act.ptoAllocated)).length > 0 ? (
                                        weeklyAttendanceReceipt.filter(act => act.type.includes('pto') || (act.type === 'call_out' && act.ptoAllocated)).map(ptoAct => (
                                            <p key={ptoAct.id} className="text-sm">
                                                - {ptoAct.type === 'pto_request' ? ptoAct.leaveType : 'Call Out'} ({ptoAct.startDate || ptoAct.date} to {ptoAct.endDate || ptoAct.date})
                                                <span className="text-lime-600 font-bold ml-2"> ({ptoAct.ptoHours || 'N/A'} hours)</span>
                                            </p>
                                        ))
                                    ) : (
                                        <p className="text-sm">No PTO used this week.</p>
                                    )}
                                    <p className="mt-4 text-xs italic">Thank you for your hard work!</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-stone-300">No attendance activity recorded for this week yet.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Employer View */}
            {userType === 'management' && (
                <div className="w-full max-w-4xl space-y-8">
                    {/* Dashboard Overview */}
                    <div className="bg-green-800 p-6 rounded-xl shadow-lg border border-amber-600">
                        <h2 className="text-2xl font-bold text-amber-400 mb-4">Management Dashboard Overview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                            <div className="bg-green-700 p-4 rounded-lg shadow-md">
                                <p className="text-lg text-stone-300">Total Employees (Simulated)</p>
                                <p className="text-4xl font-bold text-amber-300">75</p>
                            </div>
                            <div className="bg-green-700 p-4 rounded-lg shadow-md">
                                <p className="text-lg text-stone-300">Pending PTO Requests</p>
                                <p className="text-4xl font-bold text-amber-300">{allPtoRequests.filter(req => req.status === 'pending').length}</p>
                            </div>
                        </div>
                        <p className="text-stone-300 mt-4">
                            (This dashboard provides a high-level overview. Detailed attendance patterns would require more advanced data visualization.)
                        </p>
                        <div className="flex justify-center mt-6 space-x-4">
                            <button
                                onClick={() => setShowEmployerSettings(true)}
                                className="bg-stone-500 hover:bg-stone-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300"
                            >
                                Report Settings
                            </button>
                        </div>
                    </div>

                    {/* Employer Settings Modal/Section */}
                    {showEmployerSettings && (
                        <div className="bg-green-800 p-6 rounded-xl shadow-lg border border-amber-600">
                            <h2 className="text-2xl font-bold text-amber-400 mb-4">Report Settings</h2>
                            <div className="mb-4">
                                <label className="block text-stone-300 text-sm font-bold mb-2">Select Report View:</label>
                                <div className="flex space-x-4">
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio text-amber-600"
                                            name="reportView"
                                            value="all"
                                            checked={employerReportViewType === 'all'}
                                            onChange={(e) => setEmployerReportViewType(e.target.value)}
                                        />
                                        <span className="ml-2 text-stone-300">All Employees</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio text-amber-600"
                                            name="reportView"
                                            value="individual"
                                            checked={employerReportViewType === 'individual'}
                                            onChange={(e) => setEmployerReportViewType(e.target.value)}
                                        />
                                        <span className="ml-2 text-stone-300">Individual Employee Reports</span>
                                    </label>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowEmployerSettings(false)}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300"
                            >
                                Close Settings
                            </button>
                        </div>
                    )}

                    {/* Real-Time Notifications */}
                    <div className="bg-green-800 p-6 rounded-xl shadow-lg border border-lime-600">
                        <h2 className="text-2xl font-bold text-lime-400 mb-4">Recent Notifications</h2>
                        {recentNotifications.length === 0 ? (
                            <p className="text-stone-300">No new notifications.</p>
                        ) : (
                            <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {recentNotifications.map(notif => (
                                    <li key={notif.id} className="bg-green-700 p-3 rounded-lg shadow-md flex justify-between items-center">
                                        <div>
                                            <p className="text-lg">{notif.message}</p>
                                            <p className="text-xs text-stone-400">{notif.timestamp?.toDate().toLocaleString()}</p>
                                        </div>
                                        {notif.type === 'call_out' && !notif.notificationHandled && (
                                            <button
                                                onClick={() => openPtoAllocationModal(notif)}
                                                className="bg-amber-600 hover:bg-amber-700 text-white text-sm py-1 px-2 rounded-md transition duration-300"
                                            >
                                                Allocate PTO
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* PTO Allocation Modal */}
                    {showPtoAllocationModal && currentCallOutRecord && (
                        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                            <div className="bg-green-800 p-8 rounded-xl shadow-2xl text-center border border-amber-600 max-w-md w-full">
                                <h2 className="text-2xl font-bold text-amber-400 mb-4">Allocate PTO for Call Out</h2>
                                <p className="text-lg text-stone-300 mb-4">
                                    Employee: <span className="font-semibold">{currentCallOutRecord.employeeName}</span> (ID: {currentCallOutRecord.employeeId})
                                </p>
                                <p className="text-md text-stone-400 mb-6">
                                    Call Out Date: {currentCallOutRecord.date} (Reason: {currentCallOutRecord.reason})
                                </p>
                                <form onSubmit={handlePtoAllocationSubmit} className="space-y-4">
                                    <div className="mb-4">
                                        <label className="block text-stone-300 text-sm font-bold mb-2">Qualified for PTO?</label>
                                        <div className="flex justify-center space-x-6">
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    className="form-radio text-lime-600"
                                                    name="qualifiedForPto"
                                                    value="yes"
                                                    checked={isCallOutQualifiedForPto === true}
                                                    onChange={() => setIsCallOutQualifiedForPto(true)}
                                                />
                                                <span className="ml-2 text-stone-300">Yes</span>
                                            </label>
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    className="form-radio text-red-600"
                                                    name="qualifiedForPto"
                                                    value="no"
                                                    checked={isCallOutQualifiedForPto === false}
                                                    onChange={() => setIsCallOutQualifiedForPto(false)}
                                                />
                                                <span className="ml-2 text-stone-300">No</span>
                                            </label>
                                        </div>
                                    </div>
                                    {isCallOutQualifiedForPto && (
                                        <div className="mb-4">
                                            <label htmlFor="allocatedHours" className="block text-stone-300 text-sm font-bold mb-2">Hours to Allocate:</label>
                                            <input
                                                type="number"
                                                id="allocatedHours"
                                                value={allocatedCallOutPtoHours}
                                                onChange={(e) => setAllocatedCallOutPtoHours(e.target.value)}
                                                min="0"
                                                step="0.5"
                                                className="shadow appearance-none border rounded w-full py-2 px-3 text-green-900 leading-tight focus:outline-none focus:shadow-outline bg-stone-200"
                                                required
                                            />
                                        </div>
                                    )}
                                    <div className="flex space-x-4">
                                        <button
                                            type="submit"
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 flex-grow"
                                        >
                                            Confirm Allocation
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowPtoAllocationModal(false)}
                                            className="bg-stone-500 hover:bg-stone-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}


                    {/* Pending PTO Requests for Approval */}
                    <div className="bg-green-800 p-6 rounded-xl shadow-lg border border-green-600">
                        <h2 className="text-2xl font-bold text-green-400 mb-4">Pending PTO Requests</h2>
                        {allPtoRequests.filter(req => req.status === 'pending').length === 0 ? (
                            <p className="text-stone-300">No pending PTO requests.</p>
                        ) : (
                            <ul className="space-y-4">
                                {allPtoRequests.filter(req => req.status === 'pending').map(req => (
                                    <li key={req.id} className="bg-green-700 p-4 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-start md:items-center">
                                        <div>
                                            <p className="font-semibold text-lg">{req.leaveType} for Employee {req.requesterName || req.requesterId}</p>
                                            <p className="text-md text-stone-300">{req.startDate} to {req.endDate}</p>
                                            {req.notes && <p className="text-sm text-stone-300 italic">Notes: {req.notes}</p>}
                                            <p className="text-xs text-stone-400">Requested: {req.createdAt?.toDate().toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex space-x-2 mt-3 md:mt-0">
                                            <button
                                                onClick={(e) => handlePtoApproval(req.id, 'approved')}
                                                className="bg-lime-500 hover:bg-lime-600 text-white font-bold py-1.5 px-3 rounded-md text-sm shadow-md transition duration-300"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={(e) => handlePtoApproval(req.id, 'rejected')}
                                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-3 rounded-md text-sm shadow-md"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Comprehensive Attendance Report (In-App) */}
                    <div className="bg-green-800 p-6 rounded-xl shadow-lg border border-amber-600">
                        <h2 className="text-2xl font-bold text-amber-400 mb-4">Daily Attendance Report</h2>
                        <div className="mb-4">
                            <label htmlFor="reportDate" className="block text-stone-300 text-sm font-bold mb-2">Select Date:</label>
                            <input
                                type="date"
                                id="reportDate"
                                value={employerReportDate}
                                onChange={(e) => setEmployerReportDate(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-green-900 leading-tight focus:outline-none focus:shadow-outline bg-stone-200"
                                max={new Date().toISOString().split('T')[0]} // Prevent selecting future dates
                            />
                        </div>

                        {filteredAttendance.length === 0 ? (
                            <p className="text-stone-300">No attendance data available for {employerReportDate}.</p>
                        ) : (
                            <>
                                {employerReportViewType === 'all' ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-green-700 rounded-lg shadow-md">
                                            <thead>
                                                <tr className="bg-green-600 text-stone-200 uppercase text-xs leading-normal">
                                                    <th className="py-3 px-6 text-left">Employee Name</th>
                                                    <th className="py-3 px-6 text-left">ID</th>
                                                    <th className="py-3 px-6 text-left">Time</th>
                                                    <th className="py-3 px-6 text-left">Action</th>
                                                    <th className="py-3 px-6 text-left">Details</th> {/* Combined for lateness/early leave */}
                                                    <th className="py-3 px-6 text-left">Title</th>
                                                    <th className="py-3 px-6 text-left">Manager</th>
                                                    <th className="py-3 px-6 text-left">PTO Used</th> {/* New column */}
                                                </tr>
                                            </thead>
                                            <tbody className="text-stone-300 text-sm font-light">
                                                {filteredAttendance.map((record) => (
                                                    <tr key={record.id} className="border-b border-green-600 hover:bg-green-600">
                                                        <td className="py-3 px-6 text-left whitespace-nowrap">{record.employeeName}</td>
                                                        <td className="py-3 px-6 text-left">{record.employeeId}</td>
                                                        <td className="py-3 px-6 text-left">{record.time || 'N/A'}</td>
                                                        <td className="py-3 px-6 text-left">
                                                            {record.type.replace(/_/g, ' ').toUpperCase()}
                                                        </td>
                                                        <td className="py-3 px-6 text-left">
                                                            {record.type === 'call_out' && record.reason && `Reason: ${record.reason}`}
                                                            {record.type === 'late' && record.latenessDuration && `Duration: ${record.latenessDuration}`}
                                                            {record.type === 'early_leave' && record.earlyLeaveReason && `Reason: ${record.earlyLeaveReason}`}
                                                        </td>
                                                        <td className="py-3 px-6 text-left">{record.title}</td>
                                                        <td className="py-3 px-6 text-left">{record.manager}</td>
                                                        <td className="py-3 px-6 text-left">
                                                            {record.type === 'pto_request' ? `${record.ptoHours || 'N/A'} hrs` :
                                                             (record.type === 'call_out' && record.ptoAllocated ? `${record.ptoHours} hrs` : '0 hrs')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.values(groupedAttendance).map(employeeData => (
                                            <div key={employeeData.employeeId} className="bg-green-700 p-4 rounded-lg shadow-md border border-green-500">
                                                <h3 className="text-xl font-bold text-amber-300 mb-2">{employeeData.employeeName} (ID: {employeeData.employeeId})</h3>
                                                <p className="text-sm text-stone-300 mb-3">Title: {employeeData.title} | Manager: {employeeData.manager}</p>
                                                <ul className="space-y-2">
                                                    {employeeData.records.map(record => (
                                                        <li key={record.id} className="flex justify-between items-center bg-green-600 p-3 rounded-md">
                                                            <span className="font-semibold">{record.time || 'N/A'}</span>
                                                            <span className="ml-4 flex-grow">
                                                                {record.type.replace(/_/g, ' ').toUpperCase()}
                                                                {record.type === 'call_out' && record.reason && <span className="text-xs text-stone-400 italic"> ({record.reason})</span>}
                                                                {record.type === 'late' && record.latenessDuration && <span className="text-xs text-stone-400 italic"> ({record.latenessDuration})</span>}
                                                                {record.type === 'early_leave' && record.earlyLeaveReason && <span className="text-xs text-stone-400 italic"> (Reason: {record.earlyLeaveReason})</span>}
                                                                {record.type === 'call_out' && record.ptoAllocated && record.ptoHours > 0 &&
                                                                    <span className="text-lime-400 ml-1"> (+{record.ptoHours} PTO Hrs)</span>
                                                                }
                                                            </span>
                                                            <span className="text-xs text-stone-400">
                                                                PTO: {record.type === 'pto_request' ? `${record.ptoHours || 'N/A'} hrs` :
                                                                       (record.type === 'call_out' && record.ptoAllocated ? `${record.ptoHours} hrs` : '0 hrs')}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        <p className="text-stone-300 text-sm mt-4">
                            *Note: This report uses simulated data for demonstration. In a real application, this data would be fetched from a centralized attendance log or aggregated from individual employee records via a backend service.
                        </p>
                    </div>
                </div>
            )}

            {/* Feedback Mechanism */}
            <div className="w-full max-w-4xl bg-green-800 p-6 rounded-xl shadow-lg mt-8 mb-4 text-center border border-stone-600">
                <h2 className="text-2xl font-bold text-stone-400 mb-4">Feedback & Support</h2>
                <p className="text-stone-300 mb-4">Have an issue or a suggestion? Let us know!</p>
                <button
                    onClick={() => showTemporaryConfirmation("Feedback form coming soon! For now, imagine a pop-up here.")}
                    className="bg-stone-500 hover:bg-stone-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300"
                >
                    Give Feedback
                </button>
            </div>
        </div>
    );
}
