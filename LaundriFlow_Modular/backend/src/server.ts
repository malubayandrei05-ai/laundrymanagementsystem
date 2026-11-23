import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes/api.js';
import { pool } from './config/db.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// API health check
app.get('/api/health', async (req: Request, res: Response) => {
    try {
        await pool.query('SELECT 1');

        res.status(200).json({
            status: 'ok',
            database: 'connected',
            message: 'LaundriFlow API is working'
        });
    } catch (error: any) {
        console.error('Health check failed:', error.message);

        res.status(503).json({
            status: 'error',
            database: 'disconnected',
            message: 'Database connection failed'
        });
    }
});

// API routes
app.use('/api', routes);

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('API Error:', err);

    res.status(500).json({
        message: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`LaundriFlow API running on http://localhost:${PORT}`);
});