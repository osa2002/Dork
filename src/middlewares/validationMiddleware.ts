import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { ValidationError } from "../errors/CustomErrors";

export function validateRequest(schema: z.ZodObject<any>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Replace req with parsed fields to enforce sanitization and type coercion done by Zod
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query as any;
      if (parsed.params) req.params = parsed.params as any;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const invalidParams = error.issues.map((issue) => ({
          name: issue.path.slice(1).join("."), // e.g. body.email -> email
          reason: issue.message,
        }));
        
        const firstErrorMessage = error.issues[0]?.message || "Validation failed";
        next(new ValidationError(firstErrorMessage, invalidParams));
      } else {
        next(error);
      }
    }
  };
}
