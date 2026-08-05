import { FaEnvelope } from "react-icons/fa"

const Footer = () => {
    return (
        <footer className="relative w-full shrink-0 h-auto mt-6 flex flex-col justify-end items-center">
            <div className="w-full py-2 px-3 flex flex-row flex-wrap justify-between items-center text-neutral-700 border-t">
                <div className="text-sm leading-8 flex flex-row flex-wrap justify-start items-center">
                    <div className="h-full text-gray-600">The de facto GitHub star history graph</div>
                    <a className="h-full flex flex-row justify-center items-center ml-2 text-lg hover:opacity-80" href="mailto:mubelotix@gmail.com" target="_blank" rel="noopener noreferrer">
                        <FaEnvelope />
                    </a>
                </div>
                <div className="text-xs leading-8 flex flex-row flex-nowrap justify-end items-center">
                    <span className="text-gray-600">
                        Maintained by{" "}
                        <a className="link" href="https://github.com/Mubelotix" target="_blank" rel="noopener noreferrer">
                            @mubelotix
                        </a>
                        , originally built by{" "}
                        <a className="link" href="https://github.com/timqian" target="_blank" rel="noopener noreferrer">
                            @tim_qian
                        </a>
                        {" "}and Bytebase
                    </span>
                </div>
            </div>
        </footer>
    )
}

export default Footer
