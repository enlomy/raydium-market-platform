import { Sidebar, Menu, MenuItem, SubMenu } from 'react-pro-sidebar';
import { RiCoinFill } from "react-icons/ri";
import { IoIosSettings } from "react-icons/io";
import { IoBarChart } from "react-icons/io5";
import { useRouter } from 'next/router';
export default function ProSidebar() {
    const route = useRouter();

    return (
        <Sidebar
            backgroundColor="#fff">
            <div className=' w-full h-[50px] flex items-center justify-start text-[20px] px-8'>
                Tokens
            </div>
            <Menu
                rootStyles={{
                    fontSize: "16px",
                }}

                menuItemStyles={{
                    button: {
                        // the active class will be added automatically by react router
                        // so we can use it to style the active menu item
                        [`&.active`]: {
                            backgroundColor: '#13395e',
                            color: '#b6c8d9',
                            fontSize: "20px"
                        },
                    },
                }}
            >
                <MenuItem icon={<RiCoinFill />} onClick={() => { route.push('/'); }}>Token Creator</MenuItem>
                <MenuItem icon={<IoBarChart className='text-[15px]'/>} onClick={() => { route.push('/liquidity-pool'); }}>Create Liquidity Pool</MenuItem>

                <SubMenu label="Token Manager" icon={<IoIosSettings fontSize={20} />}>
                    <MenuItem onClick={() => { route.push('/openbook-market'); }}> Create OpenBook Market </MenuItem>
                    <MenuItem onClick={() => { route.push('/token-mint'); }}> Revoke Freeze Authority </MenuItem>
                    <MenuItem onClick={() => { route.push('/token-mint'); }}> Revoke Mint Authority </MenuItem>
                    <MenuItem onClick={() => { route.push('/token-mint'); }}> Make Token Immutable </MenuItem>
                    {/* <MenuItem onClick={() => { route.push('/tax-token'); }}> Tax Token Creator </MenuItem> */}
                    <MenuItem onClick={() => { route.push('/add-liquidity'); }}> Solana Liquidity Remover </MenuItem>
                    <MenuItem onClick={() => { route.push('/add-liquidity'); }}> Solana Liquidity Adder </MenuItem>
                    <MenuItem onClick={() => { route.push('/token-mint'); }}> Token Mint</MenuItem>
                    <MenuItem onClick={() => { route.push('/update-token'); }}> Update Token Metadata</MenuItem>
                </SubMenu>
            </Menu>
        </Sidebar>
    );
}
