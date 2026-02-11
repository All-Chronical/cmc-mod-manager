#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🚀 Starting CMC Mod Manager Development Server...\n');

// Step 1: Generate build.json
console.log('📝 Creating build.json...');
fs.writeFileSync(
    'build.json',
    JSON.stringify({
        platform: process.platform,
        arch: process.arch
    }, null, 2),
    { encoding: 'utf-8' }
);
console.log('✅ build.json created\n');

// Step 2: Generate language files
console.log('🌍 Generating language files...');
const genLangs = spawn('node', ['lang/gen-langs.mjs'], {
    stdio: 'inherit',
    shell: true
});

genLangs.on('exit', (code) => {
    if (code !== 0) {
        console.error('❌ Language generation failed');
        process.exit(1);
    }
    console.log('✅ Language files generated\n');

    // Step 3: Start Electron Forge
    console.log('⚡ Starting Electron Forge...\n');
    const forge = spawn('npx', ['electron-forge', 'start'], {
        stdio: 'inherit',
        shell: true,
        env: {
            ...process.env,
            NODE_ENV: 'development'
        }
    });

    forge.on('error', (err) => {
        console.error('❌ Failed to start Electron Forge:', err);
        process.exit(1);
    });

    forge.on('exit', (code) => {
        console.log('\n👋 Development server stopped');
        process.exit(code || 0);
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n\n⏸️  Stopping development server...');
        forge.kill('SIGINT');
        setTimeout(() => process.exit(0), 1000);
    });
});

genLangs.on('error', (err) => {
    console.error('❌ Failed to generate language files:', err);
    process.exit(1);
});
