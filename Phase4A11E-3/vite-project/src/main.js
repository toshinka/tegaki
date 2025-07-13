import { AppController } from './app/AppController.js';

// Wait for the document to be fully loaded before starting the app
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Application starting...");
    new AppController();
});