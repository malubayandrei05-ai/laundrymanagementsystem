import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
export function auth(req: Request, res: Response, next: NextFunction){const header=req.headers.authorization||'';const token=header.startsWith('Bearer ')?header.slice(7):'';if(!token)return res.status(401).json({message:'Login required'});try{req.user=jwt.verify(token,process.env.JWT_SECRET||'dev-secret-change-me');next();}catch{return res.status(401).json({message:'Invalid or expired token'});}}
export const role=(...roles)=>(req,res,next)=>roles.includes(req.user?.role)?next():res.status(403).json({message:'Access denied'});
