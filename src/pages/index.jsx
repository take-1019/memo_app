import { AddMemo } from "components/addMemo";

const Home = () => {
	return (
		<div>
			<h1 className="mt-4 mb-4 text-center text-4xl text-blue-500">買い物リスト</h1>
			<AddMemo />
		</div>
	);
};

export default Home;
