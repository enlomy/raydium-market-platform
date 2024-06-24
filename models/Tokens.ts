
import mongoose from 'mongoose'

export interface Tokens extends mongoose.Document {
    processing: string,
    tokenAccount: string
}

const TokensSchema = new mongoose.Schema<Tokens>({
    processing: {
        type: String
    },
    tokenAccount: {
        type: String
    }
});

let Tokens: any;
if (mongoose.models.Tokens) {
    Tokens = mongoose.model('Tokens');
} else {
    Tokens = mongoose.model('Tokens', TokensSchema);
}

export default Tokens;