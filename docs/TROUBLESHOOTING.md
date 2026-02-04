# Troubleshooting Guide

This guide provides solutions for common issues you may encounter while developing the CTFDeck App frontend.

## Table of Contents

- [Dependency Issues](#dependency-issues)
- [Build Errors](#build-errors)
- [Runtime Errors](#runtime-errors)
- [Electron-Specific Issues](#electron-specific-issues)
- [Development Server Problems](#development-server-problems)
- [Testing Issues](#testing-issues)
- [Styling Problems](#styling-problems)
- [Performance Issues](#performance-issues)
- [IDE/Editor Issues](#ideeditor-issues)
- [Platform-Specific Issues](#platform-specific-issues)

## Dependency Issues

### Node.js Version Mismatch
**Problem**: Unexpected errors during installation or runtime due to incompatible Node.js version.

**Solution**:
1. Check your Node.js version: `node --version`
2. Ensure you're using Node.js v18 or higher
3. Use a Node version manager like `nvm` to switch versions if needed:
   ```bash
   nvm install 18
   nvm use 18
   ```

### Missing Dependencies
**Problem**: Modules not found or import errors after cloning the project.

**Solution**:
1. Delete `node_modules` and `package-lock.json`:
   ```bash
   rm -rf node_modules package-lock.json
   ```
2. Reinstall dependencies:
   ```bash
   npm install
   ```

### Peer Dependency Conflicts
**Problem**: Warnings or errors about peer dependency conflicts.

**Solution**:
1. Try installing with force flag:
   ```bash
   npm install --force
   ```
2. Or use legacy peer deps:
   ```bash
   npm install --legacy-peer-deps
   ```

### Outdated Dependencies
**Problem**: Security vulnerabilities or compatibility issues with outdated packages.

**Solution**:
1. Check for outdated packages:
   ```bash
   npm outdated
   ```
2. Update packages:
   ```bash
   npm update
   ```
3. For major updates, use:
   ```bash
   npx npm-check-updates -u
   npm install
   ```

## Build Errors

### TypeScript Compilation Errors
**Problem**: Build fails due to TypeScript errors.

**Solution**:
1. Run TypeScript compiler to see detailed errors:
   ```bash
   npx tsc --noEmit
   ```
2. Fix the reported errors in your code
3. Common fixes include:
   - Adding type annotations
   - Fixing import/export statements
   - Resolving circular dependencies

### Module Resolution Errors
**Problem**: Cannot resolve modules or paths.

**Solution**:
1. Check `tsconfig.json` paths configuration:
   ```json
   {
     "paths": {
       "@ctfdeck/helm/*": ["./libs/ui/*/src/index.ts"]
     }
   }
   ```
2. Ensure path aliases match import statements
3. Restart your IDE/Editor after path changes

### Memory Issues During Build
**Problem**: Build process crashes due to insufficient memory.

**Solution**:
1. Increase Node.js memory limit:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```
2. Or use a script with increased memory:
   ```bash
   node --max-old-space-size=4096 ./node_modules/.bin/ng build
   ```

### Tailwind CSS Not Working
**Problem**: Tailwind classes are not being applied or recognized.

**Solution**:
1. Ensure Tailwind is properly configured in `postcss.config.json`:
   ```json
   {
     "plugins": {
       "@tailwindcss/postcss": {}
     }
   }
   ```
2. Check that `styles.css` imports Tailwind:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```
3. Restart the development server after configuration changes

## Runtime Errors

### Runtime Module Errors
**Problem**: Application crashes with "Module not found" or similar errors at runtime.

**Solution**:
1. Check if the module is in `dependencies` (not `devDependencies`) in `package.json`
2. If using CommonJS dependencies, add to `allowedCommonJsDependencies` in `angular.json`:
   ```json
   {
     "allowedCommonJsDependencies": ["ansi-to-html"]
   }
   ```

### Zone.js Errors
**Problem**: Errors related to Zone.js or change detection.

**Solution**:
1. Check for asynchronous operations outside Angular zone
2. Use `NgZone.run()` to run code inside Angular zone:
   ```typescript
   constructor(private ngZone: NgZone) {}
   
   someAsyncOperation() {
     this.ngZone.run(() => {
       // Update component properties here
     });
   }
   ```

## Electron-Specific Issues

### Electron Build Failures
**Problem**: `npm run electron:start` fails during build process.

**Solution**:
1. Ensure all dependencies are installed:
   ```bash
   npm install
   ```
2. Check that `electron` is properly installed:
   ```bash
   npx electron --version
   ```
3. Verify TypeScript compilation for Electron files:
   ```bash
   npx tsc -p tsconfig.electron.json
   ```

### Electron App Not Starting
**Problem**: Electron window doesn't appear or app crashes immediately.

**Solution**:
1. Check Electron main process logs in console
2. Verify `main.ts` in electron directory has correct paths
3. Ensure Angular build completed successfully before starting Electron
4. Try running Electron separately:
   ```bash
   npm run build
   npm run electron:build
   electron .
   ```

### Native Module Issues in Electron
**Problem**: Native modules not working in Electron environment.

**Solution**:
1. Rebuild native modules for Electron:
   ```bash
   npx electron-rebuild
   ```
2. Or configure in `package.json`:
   ```json
   {
     "scripts": {
       "postinstall": "electron-builder install-app-deps"
     }
   }
   ```

## Development Server Problems

### Port Already in Use
**Problem**: Development server fails to start due to port conflict.

**Solution**:
1. Change port:
   ```bash
   ng serve --port 4201
   ```
2. Or find and kill the process using the port:
   ```bash
   # On Windows
   netstat -ano | findstr :4200
   taskkill /PID <PID> /F
   
   # On macOS/Linux
   lsof -ti:4200 | xargs kill
   ```

### Hot Reload Not Working
**Problem**: Changes don't reflect automatically in browser.

**Solution**:
1. Check if file watcher is working:
   ```bash
   ng serve --poll 1000
   ```
2. Disable antivirus real-time scanning temporarily
3. Check file permissions in project directory
4. Restart the development server

### Slow Build Times
**Problem**: Development server takes too long to rebuild after changes.

**Solution**:
1. Enable build optimization:
   ```bash
   ng serve --optimization=false
   ```
2. Use isolated modules:
   ```bash
   ng serve --aot=false
   ```
3. Check disk space and system resources

## Testing Issues

### Mocking Services
**Problem**: Tests fail due to external dependencies.

**Solution**:
1. Use Angular TestBed for proper mocking:
   ```typescript
   TestBed.configureTestingModule({
     providers: [
       { provide: SomeService, useClass: MockSomeService }
     ]
   });
   ```

## Styling Problems

### Tailwind Classes Not Applied
**Problem**: Tailwind utility classes have no effect.

**Solution**:
1. Verify Tailwind is properly configured in `angular.json` styles
2. Check that content paths include your component files:
   ```js
   module.exports = {
     content: [
       './src/**/*.{html,ts}',
     ],
   }
   ```
3. Restart development server after configuration changes

### CSS Override Issues
**Problem**: Custom styles not overriding Tailwind defaults.

**Solution**:
1. Use `!important` flag carefully:
   ```css
   .custom-class {
     @apply bg-red-500 !important;
   }
   ```
2. Place custom CSS after Tailwind imports
3. Use more specific selectors

### Responsive Design Not Working
**Problem**: Responsive breakpoints not functioning correctly.

**Solution**:
1. Check viewport meta tag in `index.html`:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1">
   ```
2. Verify responsive prefixes are correct (sm:, md:, lg:, etc.)

## Performance Issues

### Slow Initial Load
**Problem**: Application takes too long to load initially.

**Solution**:
1. Enable lazy loading for routes:
   ```typescript
   const routes: Routes = [
     { path: 'feature', loadChildren: () => import('./feature/feature.module').then(m => m.FeatureModule) }
   ];
   ```
2. Implement OnPush change detection strategy
3. Optimize bundle size with webpack-bundle-analyzer

### Memory Leaks
**Problem**: Application consumes increasing memory over time.

**Solution**:
1. Unsubscribe from observables properly:
   ```typescript
   ngOnDestroy() {
     this.subscription.unsubscribe();
   }
   ```
2. Use `async` pipe when possible
3. Check for event listeners not being removed

### Slow Rendering
**Problem**: UI updates are sluggish or janky.

**Solution**:
1. Use OnPush change detection strategy
2. Optimize trackBy functions for *ngFor
3. Virtualize long lists with Angular CDK

## IDE/Editor Issues

### IntelliSense Not Working
**Problem**: Code completion and type checking not functioning properly.

**Solution**:
1. Restart TypeScript server in your editor
2. Check that `tsconfig.json` is properly configured
3. Ensure all dependencies are installed

### Linting Errors in Editor
**Problem**: Editor shows linting errors that don't match CLI output.

**Solution**:
1. Configure your editor to use project's ESLint configuration
2. Install editor plugins for Angular and TypeScript
3. Restart editor after configuration changes

### Debugging Issues
**Problem**: Debugger not stopping at breakpoints.

**Solution**:
1. Ensure source maps are enabled in development configuration
2. Check that debug configuration points to correct files
3. Verify browser debugging tools are properly configured

## Platform-Specific Issues

### Windows-Specific Issues
**Problem**: Issues occurring only on Windows platforms.

**Solution**:
1. Use forward slashes in paths instead of backslashes
2. Check line endings (CRLF vs LF):
   ```bash
   git config --global core.autocrlf true
   ```
3. Run commands in PowerShell or Git Bash instead of Command Prompt

### macOS/Linux Issues
**Problem**: Permission errors or path issues on Unix-like systems.

**Solution**:
1. Check file permissions:
   ```bash
   chmod +x ./node_modules/.bin/*
   ```
2. Ensure correct case sensitivity in imports
3. Check that symbolic links are properly resolved

### Docker Container Issues
**Problem**: Running development server in Docker containers.

**Solution**:
1. Bind to all interfaces:
   ```bash
   ng serve --host 0.0.0.0
   ```
2. Map ports correctly in docker-compose.yml
3. Check file synchronization between host and container

## Additional Resources

- [Angular CLI Issues](https://github.com/angular/angular-cli/issues)
- [Electron Troubleshooting](https://www.electronjs.org/docs/latest/tutorial/faq)
- [Tailwind CSS Troubleshooting](https://tailwindcss.com/docs/installation)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/angular) for Angular-specific issues
