import WalletButton from "./WalletButton";

export default function Header() {

    return (
        <div className=' flex w-full px-7 justify-between bg-white h-[80px] rounded-xl items-center'>
            <span className=" text-[20px]"> Capital Coin</span>
            <WalletButton />
        </div>
    );
}
