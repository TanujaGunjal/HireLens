#!/bin/bash

# B2World ATS Backend - Quick Start Script
# This script helps you get started quickly

set -e

echo "================================"
echo "  B2World ATS Backend Setup"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be 18 or higher!${NC}"
    echo "Current version: $(node -v)"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Check if MongoDB is needed (local)
echo ""
echo -e "${BLUE}MongoDB Setup:${NC}"
echo "1. Use local MongoDB (requires MongoDB installed)"
echo "2. Use MongoDB Atlas (cloud - recommended)"
read -p "Choose option (1 or 2): " MONGO_CHOICE

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cp .env.example .env
    
    if [ "$MONGO_CHOICE" == "1" ]; then
        echo "MONGODB_URI=mongodb://localhost:27017/b2world_ats" >> .env.temp
    else
        read -p "Enter your MongoDB Atlas URI: " ATLAS_URI
        echo "MONGODB_URI=$ATLAS_URI" >> .env.temp
    fi
    
    # Generate JWT secret
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "JWT_SECRET=$JWT_SECRET" >> .env.temp
    
    # Merge with .env.example
    cat .env.example .env.temp > .env
    rm .env.temp
    
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Install dependencies
echo ""
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Ask about seeding
echo ""
read -p "Do you want to seed the database with sample data? (y/n): " SEED_CHOICE

if [ "$SEED_CHOICE" == "y" ] || [ "$SEED_CHOICE" == "Y" ]; then
    echo -e "${YELLOW}🌱 Seeding database...${NC}"
    node seed.js
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database seeded successfully${NC}"
        echo ""
        echo -e "${BLUE}Admin Credentials:${NC}"
        echo "Email: admin@b2world.com"
        echo "Password: Admin@123"
    else
        echo -e "${RED}❌ Database seeding failed${NC}"
        echo "You can try again later with: node seed.js"
    fi
fi

# Start the server
echo ""
echo -e "${BLUE}Starting server...${NC}"
echo "================================"
echo ""

# Check if running in development mode
if [ "$1" == "dev" ]; then
    npm run dev
else
    read -p "Start in development mode with auto-reload? (y/n): " DEV_MODE
    
    if [ "$DEV_MODE" == "y" ] || [ "$DEV_MODE" == "Y" ]; then
        npm run dev
    else
        npm start
    fi
fi
