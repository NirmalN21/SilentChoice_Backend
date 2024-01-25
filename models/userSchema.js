import { Schema, model } from "mongoose";

const userSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    aliasName: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    profile: {
        type: String,
    },
    tokens: [
        {
            token: {
                type: String
            }
        }
    ],
    polls: [
        {
            creator: {
                type: String,
                required: true
            },
            createdOn: {
                type: Date,
                default: Date.now
            },
            deletingOn: {
                type: Date
            },
            question: {
                type: String,
                required: true
            },
            options: [
                {
                    _id: false,
                    optionText: String,
                    votes: {
                        type: Number,
                        default: 0,
                    },
                },
            ],
            votedUsers: [
                {
                    votedUser: {
                        type: String,
                    },
                    option: {
                        type: Number
                    }
                }
            ],
            votedUserCount: {
                type: Number,
                default:0
            }
        }
    ]
});

const User = model("user", userSchema);

export default User;