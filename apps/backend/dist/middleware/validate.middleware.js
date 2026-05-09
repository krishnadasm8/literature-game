"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const validate = (schema, target = "body") => (req, res, next) => {
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
exports.validate = validate;
