import type { NextFunction, Request, Response, RequestHandler } from "express";
import type Joi from "joi";

type ValidationTarget = "body" | "params" | "query";

export const validate =
  (schema: Joi.ObjectSchema, target: ValidationTarget = "body"): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      res.status(400).json({
        error: "Validation failed",
        details: error.details.map((detail) => detail.message),
      });
      return;
    }

    req[target] = value;
    next();
  };
