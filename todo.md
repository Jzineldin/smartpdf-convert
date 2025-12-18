# SmartPDF Convert - Project TODO

## Core Features
- [x] User authentication with Supabase (email/password + Google OAuth)
- [x] PDF upload with drag-and-drop interface (20MB limit)
- [x] AI-powered table extraction using GPT-4 Vision via OpenRouter
- [ ] Real-time spreadsheet editor with FortuneSheet
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
- [ ] Stripe webhook handler for subscription events
- [x] Usage check and increment endpoints
- [x] Template CRUD operations

## UI Components
- [x] Landing page with hero, features, pricing, FAQ
- [x] DropZone component for PDF upload
- [x] Processing status indicator
- [ ] Spreadsheet editor wrapper
- [x] Dashboard layout with sidebar
- [x] Conversion history list
- [x] Subscription management card
- [ ] Template selection panel

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
