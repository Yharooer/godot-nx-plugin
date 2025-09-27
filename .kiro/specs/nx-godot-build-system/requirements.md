# Requirements Document

## Introduction

This feature involves improving an existing NX-based build system for Godot game engine projects within a monorepo. The system needs to support multiple project types (Godot projects and GDExtension projects), handle dependencies correctly, and provide a robust build toolchain. The current implementation has several issues including incorrect linking, poor TypeScript practices, and coupling of build steps that need to be addressed.

## Requirements

### Requirement 1

**User Story:** As a developer, I want the godot-build-tools package to be properly configured as an NX project with correct TypeScript compilation, so that other projects can reliably consume its build rules.

#### Acceptance Criteria

1. WHEN the godot-build-tools project is built THEN it SHALL produce transpiled JavaScript files in a predictable output directory
2. WHEN other projects reference godot-build-tools THEN they SHALL use absolute package references (e.g., @yharooer/godot-build-tools) instead of relative paths
3. WHEN TypeScript compilation occurs THEN it SHALL enforce strict typing and follow TypeScript best practices
4. WHEN tsconfig files are configured THEN they SHALL properly extend base configurations and include appropriate compiler options

### Requirement 2

**User Story:** As a developer, I want Godot projects to correctly link to and use the build tools, so that their build steps execute successfully without "cannot find file" errors.

#### Acceptance Criteria

1. WHEN a Godot project defines its build configuration THEN it SHALL reference the godot-build-tools using absolute package names
2. WHEN a Godot project's build step executes THEN it SHALL successfully locate and execute the build tools
3. WHEN the build tools are updated THEN dependent projects SHALL automatically use the updated version without manual path adjustments
4. WHEN NX dependency graph is generated THEN it SHALL correctly show the relationship between godot-build-tools and consuming projects

### Requirement 3

**User Story:** As a developer, I want pre-build and build steps to be decoupled, so that different project types can share common pre-build logic while having different build implementations.

#### Acceptance Criteria

1. WHEN a pre-build step executes THEN it SHALL handle dependency symlinking to _addons folder independently of the build step
2. WHEN a build step executes THEN it SHALL be able to declare the pre-build step as a dependency while remaining decoupled from its implementation
3. WHEN different project types are defined THEN they SHALL be able to reuse the same pre-build logic with different build implementations
4. WHEN transitive dependencies exist THEN the pre-build step SHALL correctly resolve and symlink all dependencies

### Requirement 4

**User Story:** As a developer, I want the build system to properly handle Godot project builds, so that all necessary files are symlinked to the build directory while excluding specific folders.

#### Acceptance Criteria

1. WHEN a Godot project build executes THEN it SHALL symlink all project files to the build directory
2. WHEN symlinking occurs THEN it SHALL exclude the _addons folder, .godot folder, and project.godot file
3. WHEN dependencies exist THEN their build artifacts SHALL be available in the _addons folder before the build step
4. WHEN the build completes THEN the build directory SHALL contain a complete, runnable Godot project

### Requirement 5

**User Story:** As a developer, I want the build system architecture to be extensible, so that future GDExtension project types (C++/Rust) can be added without major refactoring.

#### Acceptance Criteria

1. WHEN the build system is designed THEN it SHALL use a plugin-based architecture that supports multiple project types
2. WHEN new project types are added THEN they SHALL be able to define their own build steps while reusing common functionality
3. WHEN GDExtension projects are considered THEN the architecture SHALL accommodate compilation steps (cargo/gcc) followed by bundling steps
4. WHEN build artifacts are produced THEN they SHALL follow a consistent interface that allows them to be consumed by dependent projects

### Requirement 6

**User Story:** As a developer, I want proper dependency management between projects, so that build artifacts from one project can be consumed by another project correctly.

#### Acceptance Criteria

1. WHEN a project declares dependencies THEN the build system SHALL resolve both direct and transitive dependencies
2. WHEN dependency build artifacts are available THEN they SHALL be symlinked into the consuming project's _addons directory
3. WHEN a dependency is updated THEN consuming projects SHALL automatically use the updated artifacts on their next build
4. WHEN circular dependencies exist THEN the system SHALL detect and report them as errors

### Requirement 7

**User Story:** As a developer, I want the NX workspace to follow best practices, so that the build system is maintainable and follows established patterns.

#### Acceptance Criteria

1. WHEN the workspace is configured THEN it SHALL use proper NX project configuration with appropriate targets
2. WHEN build caching is enabled THEN it SHALL correctly cache build outputs and invalidate when inputs change
3. WHEN the dependency graph is analyzed THEN it SHALL show clear relationships between all projects
4. WHEN workspace configuration is reviewed THEN it SHALL follow NX best practices for monorepo management

### Requirement 8

**User Story:** As a developer, I want comprehensive TypeScript configuration, so that code quality is maintained and development experience is optimal.

#### Acceptance Criteria

1. WHEN TypeScript files are compiled THEN they SHALL use strict mode and enforce type safety
2. WHEN tsconfig files are structured THEN they SHALL properly extend base configurations and avoid duplication
3. WHEN IDE integration is used THEN it SHALL provide proper IntelliSense and error detection
4. WHEN code is written THEN it SHALL follow consistent formatting and linting rules

### Requirement 9

**User Story:** As a developer, I want to build C++ GDExtension projects, so that I can create high-performance native extensions for Godot games.

#### Acceptance Criteria

1. WHEN a C++ GDExtension project is configured THEN it SHALL specify the godot-cpp version to use
2. WHEN a C++ GDExtension project is built THEN it SHALL compile source files from the src directory using the specified godot-cpp dependency
3. WHEN compilation occurs THEN it SHALL support multiple target platforms (macos, ios, windows, linux, android, web)
4. WHEN compilation occurs THEN it SHALL support both debug and release build types
5. WHEN compilation completes THEN it SHALL produce platform-specific library files with correct naming conventions
6. WHEN third-party C++ libraries are specified THEN they SHALL be included in the compilation process
7. WHEN other NX C++ projects are dependencies THEN they SHALL be linked during compilation
8. WHEN a setup executor is run THEN it SHALL configure IDE hints for development tools like CLion/Rider/VSCode

### Requirement 10

**User Story:** As a developer, I want to build Rust GDExtension projects, so that I can create memory-safe native extensions for Godot games.

#### Acceptance Criteria

1. WHEN a Rust GDExtension project is configured THEN it SHALL use Cargo for compilation with the godot dependency
2. WHEN a Rust GDExtension project is built THEN it SHALL compile as a cdylib crate type
3. WHEN compilation occurs THEN it SHALL support multiple target platforms using Rust's cross-compilation
4. WHEN compilation occurs THEN it SHALL support both debug and release build types
5. WHEN compilation completes THEN it SHALL produce platform-specific library files with correct naming conventions
6. WHEN dynamic linking is requested THEN it SHALL support dynamic linking options where possible
7. WHEN existing NX Rust integration exists THEN it SHALL leverage and extend that integration

### Requirement 11

**User Story:** As a developer, I want GDExtension projects to produce properly bundled artifacts, so that they can be consumed by Godot games and libraries.

#### Acceptance Criteria

1. WHEN a GDExtension project is built THEN it SHALL create a build directory containing all artifacts
2. WHEN artifacts are created THEN compiled binaries SHALL be placed in build/bin/ with platform-specific naming
3. WHEN artifacts are created THEN a .gdextension configuration file SHALL be generated in the build directory
4. WHEN the .gdextension file is generated THEN it SHALL contain correct library paths, entry symbols, and compatibility information
5. WHEN dependencies are dynamically linked THEN they SHALL be included in the dependencies section of the .gdextension file
6. WHEN the build completes THEN only final artifacts SHALL remain in the build directory (intermediate files in tmp/)
7. WHEN godot-cpp version is specified THEN the compatibility_minimum SHALL match that version

### Requirement 12

**User Story:** As a developer, I want GDExtension projects to integrate with the existing dependency system, so that Godot games can consume them seamlessly.

#### Acceptance Criteria

1. WHEN a GDExtension project is built THEN its build artifacts SHALL be available for symlinking to dependent projects
2. WHEN a Godot project depends on a GDExtension project THEN the GDExtension's build directory SHALL be symlinked to _addons
3. WHEN multiple GDExtension projects exist THEN they SHALL be able to share common build infrastructure (like godot-cpp)
4. WHEN GDExtension projects have their own dependencies THEN the dependency resolution SHALL work transitively
5. WHEN sample projects are updated THEN they SHALL demonstrate the integration between GDExtension and Godot library projects

### Requirement 13

**User Story:** As a developer, I want efficient build processes for GDExtension projects, so that compilation times are minimized and resources are shared.

#### Acceptance Criteria

1. WHEN multiple C++ GDExtension projects exist THEN they SHALL share a common godot-cpp build to avoid redundant compilation
2. WHEN godot-cpp is built THEN it SHALL be cached and reused across projects with the same version
3. WHEN cross-platform compilation is performed THEN it SHALL use appropriate toolchains and build tools
4. WHEN builds are cached THEN NX caching SHALL work correctly with GDExtension artifacts
5. WHEN builds fail THEN clear error messages SHALL be provided with actionable debugging information