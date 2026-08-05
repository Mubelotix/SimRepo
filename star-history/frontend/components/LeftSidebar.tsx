const LeftSidebar: React.FC = () => {
    return (
        <div className="sidebar-sticky">
            <div className="pt-4">
                <div className="flex justify-center gap-4 mb-3">
                    <span className="text-xs font-medium pb-1 border-b-2 text-gray-900 border-gray-900">
                        Leaderboard
                    </span>
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">
                    <p className="mb-2 font-medium text-gray-700">Work in progress</p>
                    <p>
                        The leaderboard is being rebuilt. Check back soon for per-repo star
                        growth rankings.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default LeftSidebar
