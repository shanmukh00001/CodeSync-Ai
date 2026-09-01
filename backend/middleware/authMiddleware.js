const jwt = require("jsonwebtoken");
const { AppError } = require("./errorMiddleware");

const protect = (req, res, next) => {
    let token = req.cookies && req.cookies.token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
        // Centralized: 401 in { error: { message, code } } shape.
        return next(new AppError("No token, access denied", 401, "UNAUTHENTICATED"));
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.userId = decoded.userId;

        next();

    } catch (error) {
        // Both invalid-signature and expired-token errors fall through here.
        // We do not want to leak which one occurred to the client.
        return next(new AppError("Invalid or expired token", 401, "INVALID_TOKEN"));
    }
};

module.exports = protect;