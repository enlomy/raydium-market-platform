
import mongoose from 'mongoose'

export interface Tokens extends mongoose.Document {
    processing: number,
    token: number
}

const TokensSchema = new mongoose.Schema<Tokens>({
    processing: {
        type: Number,
        default: 0
    },
    token: {
        type: Number,
        default: 1
    }
});

let Tokens: any;
if (mongoose.models.Tokens) {
    Tokens = mongoose.model('Tokens');
} else {
    Tokens = mongoose.model('Tokens', TokensSchema);
}

export default Tokens;