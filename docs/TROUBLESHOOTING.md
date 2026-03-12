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

```
nvm install 18
nvm use 18
```

### Missing Dependencies
**Problem**: Modules not found or import errors after cloning the project.

**Solution**:
1. Delete `node_modules` and `package-lock.json`:

```
rm -rf node_modules package-lock.json
```

2. Reinstall dependencies:

```
npm install
```

### Peer Dependency Conflicts
**Problem**: Warnings or errors about peer dependency conflicts.

**Solution**:

```
npm install --force
```

or

```
npm install --legacy-peer-deps
```

### Outdated Dependencies
**Problem**: Security vulnerabilities or compatibility issues with outdated packages.

**Solution**:

```
npm outdated
```

```
npm update
```

```
npx npm-check-updates -u
npm install
```

---

## Build Errors

### TypeScript Compilation Errors
**Problem**: Build fails due to TypeScript errors.

**Solution**:

```
npx tsc --noEmit
```

Then fix the reported errors.

Common fixes include:

- Adding type annotations
- Fixing import/export statements
- Resolving circular dependencies

### Module Resolution Errors
**Problem**: Cannot resolve modules or paths.

**Solution**:

Check `tsconfig.json` paths configuration:

```
{
  "paths": {
    "@ctfdeck/helm/*": ["./libs/ui/*/src/index.ts"]
  }
}
```

Restart your IDE after path changes.

### Memory Issues During Build
**Problem**: Build process crashes due to insufficient memory.

**Solution**:

```
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

or

```
node --max-old-space-size=4096 ./node_modules/.bin/ng build
```

### Tailwind CSS Not Working
**Problem**: Tailwind classes are not applied.

Check configuration:

```
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

Ensure `styles.css` imports Tailwind:

```
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Restart the development server.

---

## Runtime Errors

### Runtime Module Errors
**Problem**: Application crashes with module errors.

Check `angular.json`:

```
{
  "allowedCommonJsDependencies": ["ansi-to-html"]
}
```

### Zone.js Errors

Example fix:

```
constructor(private ngZone: NgZone) {}

someAsyncOperation() {
  this.ngZone.run(() => {
    // update component state
  });
}
```

---

## Electron-Specific Issues

### Electron Build Failures

```
npm install
```

```
npx electron --version
```

```
npx tsc -p tsconfig.electron.json
```

### Electron App Not Starting

```
npm run build
npm run electron:build
electron .
```

### Native Module Issues

```
npx electron-rebuild
```

or in `package.json`:

```
{
  "scripts": {
    "postinstall": "electron-builder install-app-deps"
  }
}
```

---

## Development Server Problems

### Port Already in Use

```
ng serve --port 4201
```

macOS/Linux:

```
lsof -ti:4200 | xargs kill
```

Windows:

```
netstat -ano | findstr :4200
taskkill /PID <PID> /F
```

### Hot Reload Not Working

```
ng serve --poll 1000
```

Restart server if necessary.

---

## Testing Issues

### Mocking Services

```
TestBed.configureTestingModule({
  providers: [
    { provide: SomeService, useClass: MockSomeService }
  ]
});
```

---

## Styling Problems

### Tailwind Classes Not Applied

Example Tailwind config:

```
module.exports = {
  content: [
    './src/**/*.{html,ts}',
  ],
}
```

### CSS Override Issues

```
.custom-class {
  @apply bg-red-500 !important;
}
```

### Responsive Design

Ensure viewport meta tag exists:

```
<meta name="viewport" content="width=device-width, initial-scale=1">
```

---

## Performance Issues

### Lazy Loading

```
const routes: Routes = [
  { path: 'feature', loadChildren: () => import('./feature/feature.module').then(m => m.FeatureModule) }
];
```

### Avoid Memory Leaks

```
ngOnDestroy() {
  this.subscription.unsubscribe();
}
```

---

## IDE/Editor Issues

### IntelliSense Not Working

- Restart TypeScript server
- Verify `tsconfig.json`
- Reinstall dependencies

### Linting Issues

- Ensure ESLint config is used by the editor
- Restart editor

### Debugger Issues

- Enable source maps
- Verify debug configuration

---

## Platform-Specific Issues

### Windows

```
git config --global core.autocrlf true
```

### macOS/Linux

```
chmod +x ./node_modules/.bin/*
```

### Docker

```
ng serve --host 0.0.0.0
```

---

## Additional Resources

- Angular CLI Issues  
  https://github.com/angular/angular-cli/issues

- Electron Troubleshooting  
  https://www.electronjs.org/docs/latest/tutorial/faq

- Tailwind CSS Troubleshooting  
  https://tailwindcss.com/docs/installation

- Stack Overflow (Angular tag)  
  https://stackoverflow.com/questions/tagged/angular
