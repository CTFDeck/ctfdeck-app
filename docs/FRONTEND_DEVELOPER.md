# Frontend Developer Documentation

Welcome to the CTFDeck App frontend developer documentation. This guide will help you set up your development environment, run the application, and understand the project structure.

## Table of Contents

- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Running the Application](#running-the-application)
- [Development Scripts](#development-scripts)
- [Project Structure](#project-structure)
- [Styling with Tailwind CSS](#styling-with-tailwind-css)
- [UI Components with SpartanNG](#ui-components-with-spartanng)
- [Testing](#testing)
- [Code Formatting](#code-formatting)
- [Building for Production](#building-for-production)
- [Electron Desktop Application](#electron-desktop-application)
- [Troubleshooting](#troubleshooting)

## Technology Stack

The CTFDeck App frontend is built with:

- **Angular** (v21.x) - Frontend framework
- **TypeScript** (v5.9.x) - Type-safe JavaScript superset
- **Tailwind CSS** - Utility-first CSS framework
- **SpartanNG** - UI component library
- **Lucide Icons** - Icon library
- **Electron** - Desktop application framework

## Prerequisites

Before starting development, ensure you have:

- **Node.js** (v18 or higher recommended)
- **npm** (v10 or higher)
- **Git**

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/CTFDeck/ctfdeck-app.git
   cd ctfdeck-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Verify the installation:
   ```bash
   npm run start
   ```

## Running the Application

### Development Mode

To run the application in development mode with hot reloading:

```bash
npm run start
```

This will start the Angular development server on `http://localhost:4200`.

### Production Build

To build the application for production:

```bash
npm run build
```

The production-ready files will be generated in the `dist/` directory.

### Watch Mode

To continuously build the application as you make changes:

```bash
npm run watch
```

## Development Scripts

The following npm scripts are available:

| Script | Description |
|--------|-------------|
| `npm run start` | Start development server with hot reload |
| `npm run build` | Build application for production |
| `npm run watch` | Build application in watch mode |
| `npm run test` | Run unit tests |
| `npm run lint` | Lint TypeScript and HTML files |
| `npm run format` | Format code with Prettier |
| `npm run electron:start` | Build and start Electron desktop application |
| `npm run package` | Package Electron application for distribution |

## Project Structure

```
src/
├── app/                    # Main application code
│   ├── components/         # Reusable components
│   ├── services/           # Shared services
│   ├── models/             # TypeScript interfaces/models
│   ├── pages/              # Page components
│   └── app.component.ts    # Root component
├── ui/                     # Custom UI components
├── styles.css              # Global styles
├── index.html              # Main HTML template
└── main.ts                 # Angular bootstrap file
```

## Styling with Tailwind CSS

The application uses Tailwind CSS for styling:

- **Configuration**: Tailwind is configured via PostCSS plugin
- **Utility classes**: Use Tailwind utility classes directly in templates
- **Custom styles**: Add custom styles in `src/styles.css`
- **Responsive design**: Use responsive prefixes (sm:, md:, lg:, xl:, 2xl:)

Example:
```html
<div class="bg-white p-4 rounded-lg shadow-md sm:p-6">
  <h2 class="text-xl font-semibold text-gray-800">Title</h2>
  <p class="mt-2 text-gray-600">Content</p>
</div>
```

## UI Components with SpartanNG

The application uses SpartanNG UI components:

- **Component library**: Built on top of Angular CDK
- **Available components**: Buttons, inputs, dialogs, tooltips, etc.
- **Import pattern**: Import individual components as needed
- **Theming**: Consistent design system throughout the app

Example usage:
```typescript
import { ButtonModule } from '@ctfdeck/helm/button';
```

## Testing

### Unit Tests

Run unit tests with Karma and Jasmine:

```bash
npm run test
```

This will execute all spec files (`*.spec.ts`) and provide coverage reports.

### Test Files

- Test files are co-located with source files
- Named with `.spec.ts` extension
- Follow Angular testing best practices

## Code Formatting

### Prettier

The project uses Prettier for consistent code formatting:

- **Configuration**: Defined in `package.json`
- **Print width**: 100 characters
- **Single quotes**: Enabled
- **HTML parser**: Uses Angular parser

Format all code:
```bash
npm run format
```

### ESLint

The project uses ESLint for code quality:

- **Configuration**: Angular ESLint preset
- **Rules**: Enforces Angular best practices
- **HTML linting**: Checks template syntax

Lint code:
```bash
npm run lint
```

## Building for Production

To create a production build:

```bash
npm run build
```

Production builds include:
- Code minification
- Tree shaking
- Asset optimization
- Bundle splitting
- Service worker (if configured)

## Electron Desktop Application

The application can be packaged as a desktop application using Electron:

### Running Electron

Build and start the Electron application:

```bash
npm run electron:start
```

This command:
1. Builds the Angular application
2. Compiles Electron main process files
3. Starts the Electron application

### Packaging Electron

Package the application for distribution:

```bash
npm run package
```

This creates platform-specific installers in the `release/` directory:
- **Windows**: NSIS installer (.exe)
- **macOS**: DMG installer (.dmg)
- **Linux**: AppImage (.AppImage)

### Electron Files

- `electron/main.ts`: Main process code
- `electron/preload.ts`: Preload script
- `package.json`: Build configuration

## Troubleshooting

### Common Issues

#### Module Resolution Errors
If you encounter module resolution errors, ensure all dependencies are installed:
```bash
npm install
```

#### TypeScript Compilation Errors
Check for TypeScript compilation errors:
```bash
npx tsc --noEmit
```

#### Tailwind Classes Not Working
Ensure Tailwind is properly configured and styles are imported in `styles.css`.

#### Electron Build Issues
Make sure Node.js and npm are properly installed and accessible from the command line.

### Development Tips

- Use Angular CLI schematics for generating components, services, etc.
- Leverage Angular DevTools browser extension for debugging
- Use Chrome DevTools for performance profiling
- Check console for warnings and errors during development

### Useful Commands

```bash
# Generate new component
ng generate component component-name

# Generate new service
ng generate service service-name

# Check Angular version
ng version

# Run specific tests
npm run test -- --include="src/app/path/to/test"

# Build with verbose output
npm run build -- --verbose
```

## Contributing

When contributing to the frontend:

1. Follow the [commit conventions](COMMIT_POLICY.md)
2. Adhere to the [branch policy](BRANCHES_POLICY.md)
3. Submit pull requests following the [merge policy](MERGE_POLICY.md)
4. Maintain consistent styling with Tailwind CSS
5. Write unit tests for new functionality
6. Format code before committing (`npm run format`)

## Additional Resources

- [Angular Documentation](https://angular.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [SpartanNG Documentation](https://github.com/ishika1727/Spartan)
- [Electron Documentation](https://www.electronjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook)