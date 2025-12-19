import React from 'react';
import { Link } from 'react-router-dom';
import './Page.css';

const Help: React.FC = () => {
  return (
    <div className="container">
      <h1>❓ Help</h1>
      
      <div className="content">
        <h2>Getting Started</h2>
        <p>
          Welcome to the Electron App! This help section provides information 
          on how to use the application and troubleshoot common issues.
        </p>

        <h2>Frequently Asked Questions</h2>
        
        <div className="faq-item">
          <strong>Q: How do I navigate between pages?</strong>
          <p>A: Use the navigation links at the bottom of each page to move between Home, About, and Help sections.</p>
        </div>

        <div className="faq-item">
          <strong>Q: How do I run the application?</strong>
          <p>A: Use the command <code>npm run dev</code> to start the application in development mode, or <code>npm start</code> for production mode.</p>
        </div>

        <div className="faq-item">
          <strong>Q: Where can I find more information?</strong>
          <p>A: Visit the About page to learn more about the application and its features.</p>
        </div>

        <h2>Support</h2>
        <p>
          If you encounter any issues or have questions, please refer to the 
          documentation or contact the development team.
        </p>
      </div>

      <Link to="/" className="nav-link">← Back to Home</Link>
    </div>
  );
};

export default Help;
