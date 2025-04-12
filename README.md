# Chatterbox - Real-time Chat Application

Chatterbox is a modern, real-time chat application built with React, TypeScript, and Supabase. It provides a seamless messaging experience with features like real-time message delivery, read receipts, and conversation management.

![Chatterbox Logo](/public/images/chatterbox-logo.svg)

## Features

- **User Authentication** - Secure email/password authentication system
- **Real-time Messaging** - Instant message delivery using Supabase Realtime
- **Message Status Tracking** - Track when messages are received, delivered, and read
- **Conversation Management** - Create and manage multiple conversations
- **User Search** - Find and start conversations with other users
- **Responsive Design** - Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Supabase (Authentication, Database, Storage, Realtime)
- **Styling**: CSS
- **Build Tool**: Vite

## Installation

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Python 3.6+ (for database setup script)
- A Supabase account and project

### Setup Steps

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/chatterbox.git
cd chatterbox
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
```

3. **Configure Supabase**

Create a `.env` file in the root directory with your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Setup

The application requires a specific database structure in Supabase. We've provided a Python script to set this up automatically.

1. **Install required Python packages**

```bash
pip install psycopg2-binary
```

2. **Run the database setup script**

```bash
python scripts/database_setup.py
```

This script will:
- Create all necessary tables (profiles, conversations, conversation_participants, messages)
- Configure Row Level Security policies
- Set up the message status tracking fields (received, delivered, read)
- Enable real-time functionality

If you're updating an existing installation and just want to add the message status tracking feature:

```bash
python scripts/database_setup.py --add-status-only
```

## Development

Start the development server:

```bash
npm run dev
# or
yarn dev
```

The application will be available at http://localhost:5173

## Building for Production

To create a production build:

```bash
npm run build
# or
yarn build
```

The build files will be generated in the `dist` directory.

## Deployment

You can serve the built files with any static file server. For example:

```bash
npm run preview
# or
yarn preview
```

For production deployment, consider using services like Vercel, Netlify, or GitHub Pages.

## Usage

1. **Sign Up/Login**: Create an account or log in to an existing one
2. **Start a Conversation**: Click the "+" button to find users and start a new conversation
3. **Send Messages**: Type your message in the input field and press Enter or click Send
4. **View Message Status**: Check message status indicators beside your sent messages:
   - ⏱ Pending: Message is being sent
   - ✓ Received: Message has reached the server
   - ✓✓ (Light blue): Message has been delivered to the recipient's device
   - ✓✓ (Blue): Message has been read by the recipient

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2025 Chatterbox

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
