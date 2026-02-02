# Implementation Plan: Prestige Command Fix

## Overview

Fix the SQL ambiguous column reference error in the prestige command's achievement progress update query. The error occurs in the UPSERT operation where `completed_at` is referenced without proper table qualification in the COALESCE function.

## Tasks

- [x] 1. Locate and fix the achievement progress UPSERT query
  - Find the database query that updates `player_achievement_progress` table
  - Identify the COALESCE function with ambiguous `completed_at` reference
  - Qualify the column reference (e.g., `player_achievement_progress.completed_at` or use table alias)
  - _Requirements: 1.1, 1.2_

- [x] 2. Test achievement progress updates
  - Test inserting new achievement progress records
  - Test updating existing achievement progress records
  - Verify `completed_at` timestamp is set correctly for new completions
  - Verify `completed_at` timestamp is preserved for already-completed achievements
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Add error handling and logging
  - Ensure database errors are caught and logged with details
  - Return user-friendly error messages when queries fail
  - _Requirements: 1.5_

- [x] 4. Verify prestige command functionality
  - Run the prestige command and confirm no SQL errors occur
  - Verify achievement progress is tracked correctly
  - Check that prestige points are awarded properly
  - _Requirements: 1.1_
