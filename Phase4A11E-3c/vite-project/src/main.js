import { AppBootstrap } from './app/AppController.js'; //変更: AppController -> AppBootstrap

// Wait for the document to be fully loaded before starting the app
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Application starting...");
    new AppBootstrap(); //変更: AppController -> AppBootstrap
});