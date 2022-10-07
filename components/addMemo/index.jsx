import { useState } from "react";

export const AddMemo = () => {
	const [text, setText] = useState("");
	const [memos, setMemos] = useState(["野菜", "肉"]);

	// const handleClick = (e) => {
	// 	setText("");
	// 	setMemos([
	// 		{
	// 			id: memos,
	// 			text: text,
	// 		},
	// 	]);
	// };

	const onChangeText = (e) => setText(e.target.value);

	const onClickAdd = () => {
		if (text === "") return;
		const newMemos = [...memos, text];
		setMemos(newMemos);
		setText("");
	};

	const onClickDelete = (index) => {
		const newMemos = [...memos];
		newMemos.splice(index, 1);
		setMemos(newMemos);
	};

	return (
		<div className="m-10 text-center">
			<div className="m-10">
				<input type="text" value={text} className="mr-4 rounded-sm border border-black" id="username" onChange={onChangeText} />
				<button onClick={onClickAdd} className="rounded-sm border border-black px-2">
					追加
				</button>
			</div>
			<ul>
				{memos.map((memo, index) => {
					return (
						<div key={memo}>
							<ul>
								<li className="mb-2 flex justify-center">
									{/* <input type="checkbox" /> */}
									<p>{memo}</p>
									<button onClick={() => onClickDelete(index)} className="ml-4 rounded-sm border border-black px-2">
										削除
									</button>
								</li>
							</ul>
						</div>
					);
				})}
			</ul>
		</div>
	);
};
