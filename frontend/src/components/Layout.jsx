import Header from "./Header";
import { ToastContainer } from "react-toastify";

export default function Layout({children}){
    return(
        <>
            <Header/>
            <main>
                { children }
            </main>
            <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
            />
        </>
    )
}