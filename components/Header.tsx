import WalletButton from "./WalletButton";

export default function Header() {

    return (
        <div className='flex justify-between items-center bg-white px-7 rounded-xl w-full h-[80px]'>
            <span className="text-[20px]"> Raydium Market Platform</span>
            <WalletButton />
        </div>
    );
}
