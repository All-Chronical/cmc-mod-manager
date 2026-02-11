#!/usr/bin/env node

const { spawn, fork } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');

console.log('🚀 CMC Mod Manager - Development Server\n');

let electronProcess = null;
let isClosing = false;

// Step 1: Generate build.json
console.log('📝 Creating build.json...');
fs.writeFileSync(
    path.join(__dirname, 'build.json'),
    JSON.stringify({
        platform: process.platform,
        arch: process.arch
    }, null, 2),
    { encoding: 'utf-8' }
);
console.log('✅ build.json created\n');

// Step 2: Generate language files
console.log('🌍 Generating language files...');
const genLangsProcess = fork(path.join(__dirname, 'lang', 'gen-langs.mjs'));

genLangsProcess.on('exit', (code) => {
    if (code !== 0) {
        console.error('❌ Language generation failed with code:', code);
        process.exit(1);
    }
    console.log('✅ Language files generated\n');
    startWebpackAndElectron();
});

genLangsProcess.on('error', (err) => {
    console.error('❌ Failed to generate language files:', err);
    process.exit(1);
});

function startWebpackAndElectron() {
    console.log('⚡ Starting Webpack compilation...\n');

    // Load webpack configs
    const mainConfig = require('./webpack.main.config.ts');
    const { rendererConfig } = require('./webpack.renderer.config.ts');
    const { plugins } = require('./webpack.plugins.ts');

    // Configure main process webpack
    mainConfig.mode = 'development';
    mainConfig.output = {
        path: path.join(__dirname, '.webpack', 'main'),
        filename: 'index.js'
    };

    // Create webpack compiler
    const compiler = webpack([mainConfig]);

    let initialCompileDone = false;

    compiler.watch({}, (err, stats) => {
        if (err) {
            console.error('❌ Webpack compilation error:', err);
            return;
        }

        if (stats.hasErrors()) {
            console.error('❌ Webpack compilation failed:\n');
            console.error(stats.toString({ colors: true, chunks: false }));
            return;
        }

        if (!initialCompileDone) {
            console.log('✅ Initial webpack compilation complete\n');
            console.log('🎯 Starting Electron...\n');
            initialCompileDone = true;
            startElectron();
        } else {
            console.log('♻️  Recompiled. Restart Electron to see changes.\n');
        }
    });

    // Handle cleanup
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
}

function startElectron() {
    if (isClosing) return;

    const electronPath = require('electron');

    electronProcess = spawn(electronPath, [path.join(__dirname, '.webpack', 'main')], {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'development',
            ELECTRON_IS_DEV: '1'
        }
    });

    electronProcess.on('close', (code) => {
        if (!isClosing) {
            console.log('\n👋 Electron closed. Press Ctrl+C to stop the dev server.\n');
        }
        electronProcess = null;
    });

    electronProcess.on('error', (err) => {
        console.error('❌ Failed to start Electron:', err);
    });
}

function cleanup() {
    if (isClosing) return;
    isClosing = true;

    console.log('\n\n⏸️  Shutting down dev server...');

    if (electronProcess) {
        electronProcess.kill('SIGTERM');
        electronProcess = null;
    }

    setTimeout(() => {
        console.log('👋 Dev server stopped');
        process.exit(0);
    }, 500);
}
