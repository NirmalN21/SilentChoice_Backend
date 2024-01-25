import bcrypt from "bcryptjs"
import dotenv from "dotenv";
import { Router } from "express";
import jsonwebtoken from "jsonwebtoken";
import cookieParser from "cookie-parser";
import User from "../models/userSchema.js";
import verifyToken from "../authentication/auth.js";

dotenv.config({ path: "./config.env" });

const userRoutes = Router();

userRoutes.use(cookieParser());

userRoutes.get("/", async (req, res) => {
    const date = Date();
    res.send(date);
})

userRoutes.post("/user/register", async (req, res) => {

    const { username, aliasName, password } = req.body;

    try {
        const findUser = await User.findOne({ username: username });

        if (!findUser) {

            const hash = await bcrypt.hash(password, 12);

            const user = new User({ username, aliasName, password: hash });

            await user.save();
            res.send("User Saved Successfully");
        }

    }
    catch (err) {
        console.log("Error", err);
    }
});

userRoutes.post("/user/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        const findUser = await User.findOne({ username: username });

        if (findUser) {

            const isMatch = bcrypt.compare(password, findUser.password);

            if (isMatch) {

                // Generating token using jsonwebtoken
                let token = jsonwebtoken.sign({ _id: findUser._id }, process.env.SECRET_KEY);
                findUser.tokens = findUser.tokens.concat({ token: token });

                // Creating cookie using the generated token
                res.cookie("jwtoken", token, {
                    expiresIn: new Date(Date.now() + 86400000),
                    httpOnly: false
                });

                await findUser.save();

                return res.json({ message: "User Login Successfull!!!" });

            } else {
                return res.status(401).json({ error: "Invalid Credentials!!! pass" });
            }

        }

    }
    catch (err) {
        console.log("Error", err);
    }

});

userRoutes.get("/user/getData/:cookieValue", async (req, res) => {

    try {

        const cookieValue = req.params.cookieValue;

        const result = await verifyToken(cookieValue);

        if (result.success) {
            res.send(result.user)
        } else {
            throw new Error("Route User Not Found");
        }

    } catch (error) {
        res.status(401).send("Unauthorized: No token Provided");
        console.log(error);
    }

});

userRoutes.post("/user/create-poll", async (req, res) => {

    try {

        const cookieValue = req.body.cookieValue;

        const result = await verifyToken(cookieValue);

        if (result.success) {

            const rootUser = result.user;
            const { deletingOn, question, options } = req.body.pollData;

            if (!question || !options || options.length < 2) {
                return res.status(400).json({ error: 'Invalid poll data' });
            }

            const newPoll = {
                creator: rootUser.aliasName,
                deletingOn: deletingOn || Date.now() + 30 * 24 * 60 * 60 * 1000,
                question,
                options: options.map((optionText) => ({ optionText })),
            };

            rootUser.polls.push(newPoll);

            await rootUser.save();

            return res.status(201).json({ message: "Poll created Successfully" })

        } else {
            throw new Error("Login First")
        }

    } catch (error) {
        console.log(error);
    }
});

userRoutes.post("/user/deletePoll", async (req, res) => {
    try {
        const cookieValue = req.query.cookieValue;
        const result = await verifyToken(cookieValue);

        if (result.success) {
            const userId = result.user._id;
            const pollId = req.query.pollId;

            // Ensure that the user is the creator of the poll before deleting
            const poll = await User.findOne({ _id: userId, 'polls._id': pollId });
            if (!poll) {
                return res.status(404).json({ error: 'Poll not found or unauthorized' });
            }

            // Pull the poll from the user's polls array
            await User.updateOne({ _id: userId }, { $pull: { polls: { _id: pollId } } });

            res.status(200).json({ message: "Poll deleted successfully" });
        } else {
            throw new Error("Login First");
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

userRoutes.get('/user/myPolls', async (req, res) => {
    try {
        const cookieValue = req.query.cookieValue;

        const result = await verifyToken(cookieValue);
        let userId;

        if (result.success) {
            userId = result.user._id;
        } else {
            throw new Error("Login First");
        }

        // Find the user by ID and retrieve their polls
        const user = await User.findById(userId, 'polls');

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userPolls = user.polls.map((poll) => ({
            _id: poll._id,
            createdOn: poll.createdOn,
            question: poll.question,
            options: poll.options,
            votedUserCount: poll.votedUserCount,
        }));

        userPolls.sort((a, b) => b.createdOn - a.createdOn);
        res.status(200).json(userPolls);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


userRoutes.get('/user/timeline', async (req, res) => {
    try {

        // Get the username from the request query
        const cookieValue = req.query.cookieValue;

        const result = await verifyToken(cookieValue);
        let username;

        if (result.success) {
            username = result.user.username;
        } else {
            throw new Error("Login First")
        }

        // Fetch all polls from all users
        const allPolls = await User.find({}, 'polls');

        // Flatten the polls array
        const flattenedPolls = allPolls.flatMap((user) => user.polls);

        // Exclude polls where Date.now() > deletingOn
        const validPolls = flattenedPolls.filter((poll) => {
            // If deletingOn is not set, or if Date.now() is before deletingOn
            return !poll.deletingOn || Date.now() <= new Date(poll.deletingOn).getTime();
        });

        if (req.query.type === "latest") {
            // Sort the flattened polls array by the 'createdOn' field in descending order
            validPolls.sort((a, b) => b.createdOn - a.createdOn);
        } else {
            // Sort the flattened polls array by the 'votedUserCount' field in descending order
            validPolls.sort((a, b) => b.votedUserCount - a.votedUserCount);
        }

        // Iterate through polls and options, set 'selected' and 'hasVoted' fields
        const pollsWithSelection = validPolls.map((poll) => {
            const selectedOptions = poll.votedUsers
                .filter((votedUser) => votedUser.votedUser === username)
                .map((votedUser) => votedUser.option);

            const optionsWithSelection = poll.options.map((option, index) => ({
                optionText: option.optionText,
                votes: option.votes,
                selected: selectedOptions.includes(index),
            }));

            const hasVoted = selectedOptions.length > 0;

            return {
                _id: poll._id,
                createdOn: poll.createdOn,
                creator: poll.creator,
                question: poll.question,
                options: optionsWithSelection,
                hasVoted,
                votedUserCount: poll.votedUserCount,
            };
        });

        res.status(200).json(pollsWithSelection);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

userRoutes.post('/user/vote', async (req, res) => {

    try {

        const { pollId, optionIndex, cookieValue } = req.body;
        let username;

        const result = await verifyToken(cookieValue);

        if (result.success) {
            username = result.user.username;
        } else {
            return res.status(401).json({ error: "Login First" });
        }

        // Find the poll globally across all users
        const poll = await User.findOne({ "polls._id": pollId }, "polls.$");
        if (!poll) {
            return res.status(401).json({ error: "Poll not found" });
        }

        // Check if the user has already voted
        if (poll.polls[0].votedUsers.some((votedUser) => votedUser.votedUser === username)) {
            return res.status(400).json({ error: "User already voted on this poll" });
        }

        const updateQuery = {
            $inc: {
                [`polls.$[pollIndex].options.${optionIndex}.votes`]: 1,
                'polls.$[pollIndex].votedUserCount': 1
            },
            $push: {
                'polls.$[pollIndex].votedUsers': { votedUser: username, option: optionIndex }
            },
        };

        const arrayFilters = [{ 'pollIndex._id': pollId }];

        await User.updateOne({ 'polls._id': pollId }, updateQuery, { arrayFilters });

        // Save the updated user document
        await poll.save();

        res.status(200).json({ message: 'Vote recorded successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default userRoutes;