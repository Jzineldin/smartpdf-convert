# SmartPDF Convert - Project TODO

## Core Features
- [x] User authentication with Supabase (email/password + Google OAuth)
- [x] PDF upload with drag-and-drop interface (20MB limit)
- [x] AI-powered table extraction using GPT-4 Vision via OpenRouter
- [x] Real-time spreadsheet editor with FortuneSheet
- [x] Usage tracking system (3 free/day, unlimited for Pro)
- [x] Stripe payment integration ($9/month Pro subscription)
- [x] Conversion history dashboard with download capability
- [x] Excel (.xlsx) export functionality
- [x] Template system (Invoice, Inventory, Employee List, Expense Report, Sales Report)
- [x] AI confidence scoring and warning system

## Database Schema
- [x] Users table with subscription fields
- [x] Conversions table for tracking PDF conversions
- [x] Anonymous usage table for IP-based rate limiting
- [x] Templates table for predefined formats

## API Routes
- [x] PDF conversion endpoint with OpenRouter integration
- [x] Stripe webhook handler for subscription events
- [x] Usage check and increment endpoints
- [x] Template CRUD operations

## UI Components
- [x] Landing page with hero, features, pricing, FAQ
- [x] DropZone component for PDF upload
- [x] Processing status indicator
- [x] Spreadsheet editor wrapper
- [x] Dashboard layout with sidebar
- [x] Conversion history list
- [x] Subscription management card
- [x] Template selection panel

## Integrations
- [x] Supabase client configuration
- [x] OpenRouter API client for GPT-4 Vision
- [x] Stripe checkout and webhook handling
- [x] Excel file generation (xlsx)

## Polish
- [x] Dark/light theme support
- [x] Responsive design for mobile
- [x] Error handling and user feedback
- [x] Loading states and skeletons


## New Features (In Progress)
- [x] Stripe webhook endpoint for subscription events
- [x] Real-time spreadsheet editor for reviewing/editing extracted data
- [x] Google OAuth configuration instructions

## Bug Fixes
- [x] Fix OpenRouter API integration - Updated to accept PNG/JPG images directly, PDF files now show helpful error message to convert to image first

## New Improvements (In Progress)
- [x] Server-side PDF-to-image conversion for automatic PDF processing
- [x] Update landing page text to reflect multi-format support
- [x] Add PDF conversion helper with instructions for users

## Multi-Page PDF Support
- [x] Update PDF conversion to process all pages (up to 10)
- [x] Modify AI extraction to handle multiple pages sequentially
- [x] Combine extracted tables from all pages into single result
- [x] Update UI to show multi-page processing progress

## Bug Fixes - Data Extraction
- [x] Fix date format preservation (2018-03-01 not 2018-03)
- [x] Fix currency format preservation (46000:- not 46000+)
- [x] Update AI prompt to preserve original formats exactly

## Bug Fix - Page Count Detection
- [x] Fix PDF page count detection to only process existing pages
- [x] Remove false warnings about non-existent pages (3-10 on a 2-page PDF)

## New Features - UX Improvements
- [x] Replace spreadsheet editor with FortuneSheet (Google Sheets-like)
- [x] Add progress percentage during multi-page processing
- [x] Add copy table to clipboard button
- [x] Create conversion history page for logged-in users
- [x] Push project to GitHub (https://github.com/Jzineldin/smartpdf-convert)

## Bug Fix - Export Error
- [x] Fix null check in exportToExcel - handle both celldata and data array formats from FortuneSheet

## Specialized Templates (Pro Feature)
- [x] Create template data structure with optimized AI prompts
- [x] Invoice Template - extract vendor, line items, totals, dates
- [x] Bank Statement Template - extract transactions, running balance, account info
- [x] Build template selection UI with Pro-only badges
- [x] Gate specialized templates behind Pro subscription
- [x] Integrate template selection into conversion flow
- [ ] Add confidence scoring display (Pro feature)

## Try Sample Feature
- [x] Create sample demo images for each Pro template (Invoice, Bank Statement, etc.)
- [x] Add "Try Sample" button to template selector UI
- [x] Implement sample loading and processing flow
- [x] Allow non-Pro users to try Pro templates with sample documents only
