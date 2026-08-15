import Link from "next/link"
import { FaEnvelope } from "react-icons/fa"

const Footer = () => {
    return (
        <footer className="relative w-full shrink-0 h-auto mt-6 flex flex-col justify-end items-center">
            <div className="w-full py-2 px-3 flex flex-row flex-wrap justify-between items-center text-neutral-700 border-t">
                <div className="text-sm leading-8 flex flex-row flex-wrap justify-start items-center">
                    <span className="text-gray-600">
                        GitHub star history, revived
                    </span>
                </div>
                <div className="text-xs leading-8 flex flex-row flex-nowrap justify-end items-center gap-3">
                    <a className="link" href="https://github.com/sponsors/Mubelotix" target="_blank" rel="noopener noreferrer">
                        Donate
                    </a>
                    <a className="link" href="https://github.com/Mubelotix/SimRepo" target="_blank" rel="noopener noreferrer">
                        Extension
                    </a>
                    <Link className="link" href="/privacy">
                        Privacy
                    </Link>
                    <Link className="link" href="/mentions-legales">
                        Mentions légales
                    </Link>
                    <a className="h-full flex flex-row justify-center items-center text-lg hover:opacity-80" href="mailto:mubelotix@gmail.com" target="_blank" rel="noopener noreferrer">
                        <FaEnvelope />
                    </a>
                </div>
            </div>
        </footer>
    )
}

export default Footer
