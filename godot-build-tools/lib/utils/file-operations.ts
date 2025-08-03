/**
 * Shared utility functions for file operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileSystemError } from '../core/errors';

/**
 * Type for symlink types
 */
export type SymlinkType = 'file' | 'dir';

/**
 * Safely remove a directory or file
 * @param targetPath Path to remove
 * @param projectName Optional project name for error context
 */
export function safeRemove(targetPath: string, projectName?: string): void {
  try {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  } catch (error) {
    throw new FileSystemError(
      `Failed to remove ${targetPath}: ${error instanceof Error ? error.message : String(error)}`,
      projectName,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Safely create a directory
 * @param targetPath Path to create
 * @param projectName Optional project name for error context
 */
export function safeCreateDir(targetPath: string, projectName?: string): void {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
  } catch (error) {
    throw new FileSystemError(
      `Failed to create directory ${targetPath}: ${error instanceof Error ? error.message : String(error)}`,
      projectName,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Safely create a symlink
 * @param source Source path
 * @param destination Destination path
 * @param type Type of symlink
 * @param projectName Optional project name for error context
 */
export function safeSymlink(
  source: string,
  destination: string,
  type: SymlinkType,
  projectName?: string
): void {
  try {
    // Remove existing symlink or file if it exists
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }

    fs.symlinkSync(source, destination, type);
  } catch (error) {
    throw new FileSystemError(
      `Failed to create symlink from ${source} to ${destination}: ${error instanceof Error ? error.message : String(error)}`,
      projectName,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if a path exists and is accessible
 * @param targetPath Path to check
 * @returns True if path exists and is accessible
 */
export function pathExists(targetPath: string): boolean {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory
 * @param targetPath Path to check
 * @returns True if path exists and is a directory
 */
export function isDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get all entries in a directory, excluding specified patterns
 * @param dirPath Directory path
 * @param excludePatterns Patterns to exclude (exact matches)
 * @returns Array of entry names
 */
export function getDirectoryEntries(dirPath: string, excludePatterns: readonly string[] = []): readonly string[] {
  try {
    return fs.readdirSync(dirPath).filter(entry => !excludePatterns.includes(entry));
  } catch (error) {
    throw new FileSystemError(
      `Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Clean and recreate a directory
 * @param dirPath Directory path
 * @param projectName Optional project name for error context
 */
export function cleanAndCreateDir(dirPath: string, projectName?: string): void {
  safeRemove(dirPath, projectName);
  safeCreateDir(dirPath, projectName);
}

/**
 * Ensure a directory exists (create if it doesn't)
 * @param dirPath Directory path
 * @param projectName Optional project name for error context
 */
export async function ensureDirectoryExists(dirPath: string, projectName?: string): Promise<void> {
  if (!pathExists(dirPath)) {
    safeCreateDir(dirPath, projectName);
  }
}

/**
 * Remove a directory or file
 * @param targetPath Path to remove
 * @param projectName Optional project name for error context
 */
export async function removeDirectory(targetPath: string, projectName?: string): Promise<void> {
  safeRemove(targetPath, projectName);
}

/**
 * Create a symlink
 * @param source Source path
 * @param destination Destination path
 * @param projectName Optional project name for error context
 */
export async function createSymlink(source: string, destination: string, projectName?: string): Promise<void> {
  // Determine if source is a directory or file
  const type: SymlinkType = isDirectory(source) ? 'dir' : 'file';
  safeSymlink(source, destination, type, projectName);
}

/**
 * Symlink all files and directories from source to destination, excluding specified patterns
 * @param sourceDir Source directory
 * @param destDir Destination directory
 * @param excludePatterns Patterns to exclude
 * @param projectName Optional project name for error context
 */
export async function symlinkProjectFiles(
  sourceDir: string,
  destDir: string,
  excludePatterns: readonly string[] = [],
  projectName?: string
): Promise<void> {
  const entries = getDirectoryEntries(sourceDir, excludePatterns);
  
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);
    const destPath = path.join(destDir, entry);
    
    await createSymlink(sourcePath, destPath, projectName);
  }
}