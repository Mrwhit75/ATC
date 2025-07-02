# ATC Attendance Tracking Application 🏢

A comprehensive React-based attendance tracking and PTO management system for businesses.

## Features

### Employee Features
- **Attendance Reporting**: Call out, lateness, and early leave reporting
- **PTO Management**: Request and track paid time off
- **Profile Management**: Set up and maintain employee profiles
- **Weekly Receipts**: View attendance summaries

### Management Features
- **Dashboard**: Real-time overview of company attendance
- **PTO Approval**: Review and approve/reject PTO requests
- **Attendance Reports**: Daily and individual employee reports
- **PTO Allocation**: Allocate PTO hours for call-outs
- **Notifications**: Real-time notifications for attendance events

## Technology Stack

- **Frontend**: React.js with Hooks
- **Backend**: Firebase (Firestore, Authentication)
- **Styling**: Tailwind CSS
- **State Management**: React useState and useEffect
- **Real-time Updates**: Firebase onSnapshot listeners

## Key Components

### Authentication
- Anonymous authentication for demo purposes
- Custom token authentication support
- Profile setup for new users

### Data Management
- Firestore collections for users, attendance, PTO requests
- Real-time synchronization
- Error handling and fallbacks

### UI/UX
- Responsive design
- Accessibility features
- Confirmation messages
- Modal dialogs for complex actions

## File Structure

```
atc-attendance-app/
├── atc.jsx          # Main React application component
└── README.md        # This documentation
```

## Setup Instructions

1. **Firebase Configuration**: Set up Firebase project and add configuration
2. **Environment Variables**: Configure Firebase credentials
3. **Dependencies**: Install React and Firebase packages
4. **Run Application**: Start the development server

## Usage

### For Employees
1. Log in with employee credentials
2. Set up profile if first time
3. Submit attendance reports (call out, late, early leave)
4. Request PTO when needed
5. View weekly attendance receipts

### For Management
1. Log in with management credentials
2. View real-time attendance dashboard
3. Approve/reject PTO requests
4. Allocate PTO for call-outs
5. Generate attendance reports

## Recent Bug Fixes

- ✅ Fixed undefined `e.preventDefault()` in PTO approval function
- ✅ Corrected invalid CSS class `shadow-300` to `shadow-md`
- ✅ Improved error handling and user feedback

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

Business application - Internal use only

## Contributing

This is a business application. Please contact the development team for contributions.
