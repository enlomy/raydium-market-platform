## Raydium Token and Market Platform

### Description

This platform allows users to create tokens, markets, and liquidity pools on Raydium, a decentralized exchange and automated market maker on the Solana blockchain. Built with Next.js, this project provides a user-friendly interface for token creation, market setup, and liquidity management.

### Features

- **Token Creation**:
  - Create custom tokens with specified names, symbols, and images.
  - Revoke token authority to ensure decentralized control.

- **Market Creation**:
  - Set up markets for trading tokens on Raydium.
  - Customize market parameters to suit different trading strategies.

- **Liquidity Pool Management**:
  - Create and manage liquidity pools on Raydium.
  - Add and remove liquidity to/from pools.
  - Burn SPL tokens as needed for liquidity adjustments.

### Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/poseisol/raydium-market-platform.git
    cd raydium-market-platform
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

### Usage

1. Configure your environment:
    - Create a `.env` file in the root directory.
    - Add your Solana API endpoint and any other necessary configuration variables.

2. Run the development server:
    ```bash
    npm run dev
    ```

3. Open your browser and navigate to `http://localhost:3000` to access the platform.

### Scripts

- **Build**: `npm run build` - Builds the Next.js application for production.
- **Start**: `npm start` - Starts the production server.
- **Lint**: `npm run lint` - Lints the code using ESLint.
- **Test**: `npm run test` - Runs unit tests.

### Technologies Used

- **Next.js**: For server-side rendering and static site generation.
- **Solana Web3.js**: For interacting with the Solana blockchain.
- **Raydium SDK**: For interacting with Raydium's decentralized exchange.
- **Node.js**: For server-side logic.
- **Jest**: For unit testing.

### Contributing

Contributions are welcome! Please submit a pull request or open an issue to discuss potential changes.

### License

This project is licensed under the MIT License.