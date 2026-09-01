// Validation middleware: parses req[source] against a Zod schema and either
// replaces it with the parsed value or forwards the failure to the
// centralized error middleware (errorMiddleware.js).

const validate = (schema, source = "body") => (req, res, next) => {
    try {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            // Re-throw as ZodError so errorMiddleware recognizes it.
            return next(result.error);
        }

        // Replace with parsed (and possibly transformed/coerced) data.
        req[source] = result.data;
        return next();
    } catch (err) {
        return next(err);
    }
};

module.exports = validate;