from src.solver.RushHour import RushHour
from src.solver.SearchProblem import SearchProblem
import argparse
import time
import json
import os
import sys

def reset_search_problem():
    """
    Resets the shared class attributes of the SearchProblem2 class.
    """
    SearchProblem.stop = False;
    SearchProblem.visited = [];
    SearchProblem.unique = set();
    SearchProblem.depth = 0;
    SearchProblem.continue_search = False;
    SearchProblem.unique_solutions = [];
    SearchProblem.num_visited = 0;
    SearchProblem.start_time = 0.0;
    SearchProblem.visited_dictionary = {};
    SearchProblem.unique_dictionary = {};
    SearchProblem.admissability = [];
    SearchProblem.started = False;
    SearchProblem.max_depth = 18;
    SearchProblem.deadline = None;
    SearchProblem.timed_out = False;
    SearchProblem.cancelled = False;
    SearchProblem.stop_reason = None;
   
def write_solutions(problem_type,
                   puzzle_number,
                   algorithm,
                   heuristic,
                   solutions, 
                   start_state, 
                   max_depth,
                   unique_dictionary, 
                   visited_dictionary,
                   time_taken,
                   unique, 
                   visited,
                   admissability,
                   file_name, 
                   append=True,):
    """
    Writes a summary of results for DFS and BFS to a JSON file.
    """

    # handle no solution cases
    sol_one = solutions[0] if solutions else None;
    time_to_first = None;
    path = None;
    depth = None;

    if sol_one:
        time_to_first = sol_one[4];
        path = sol_one[0];
        depth = sol_one[1];


    # load BFS solution depth for this specific puzzle
    bfs_solution_depth = None;
    is_admissible = None;

    # check if heuristic scores are admissible
    if algorithm == "bestFS":
        bfs_file = "bfs_results.json";
        if os.path.exists(bfs_file):
            try:
                with open(bfs_file, 'r') as f:
                    bfs_results = json.load(f);
                
                # extract BFS solution depth for puzzle_number
                for puzzle in bfs_results:
                    if puzzle["summary"]["puzzle_number"] == puzzle_number:
                        bfs_solution_depth = puzzle["summary"]["solution_depth"];
                        break;

            except json.JSONDecodeError:
                print(f"could not parse {bfs_file}, skipping check.");
        
        is_admissible = True
        if bfs_solution_depth is not None:
            for score, _ in admissability:
                if score > bfs_solution_depth:
                    is_admissible = False;
                    break;

    summary = {
        "problem": problem_type,
        "puzzle_number": puzzle_number,
        "algorithm": algorithm,
        "heuristic": heuristic,
        "max_depth": max_depth,
        "time_taken": time_taken,
        "solutions": len(solutions),
        "time_to_1st_solution": time_to_first,
        "path_to_1st_solution": path,
        "is_admissible": is_admissible,
        "solution_depth": depth,
        "unique_states": unique,
        "states_visited": visited,
        "start_state": start_state,
    }
    
    # unique depth analysis
    unique_depth_analysis = {
        "unique_depth_analysis": {
            str(depth): count for depth, count in unique_dictionary.items()
        }}
    
    # visited depth analysis
    visited_depth_analysis = {
        "visited_depth_analysis": {
            str(depth): count for depth, count in visited_dictionary.items()
        }
    }

    # non looping paths to solution 
    results = [
        {
            "path": solution[0],
            "depth": solution[1],
            "num_visited": solution[2],
            "unique_states_at_solution": solution[3],
            "time": solution[4],
        }
        for solution in solutions
    ]

    # structure to write to file
    log_entry = {
        "summary": summary,
        "unique_depth_analysis": unique_depth_analysis,
        "visited_depth_analysis": visited_depth_analysis,
        "results": results
    }

    # write or append to the JSON file
    try:
        if append and os.path.exists(file_name):
            with open(file_name, "r+") as file:
                # load existing data
                file.seek(0);
                try:
                    existing_data = json.load(file);
                except json.JSONDecodeError:
                    existing_data = [];

                # add comma if existing data is non-empty
                if existing_data:
                    existing_data.append(log_entry);
                else:
                    existing_data = [log_entry];

                # write back to file
                file.seek(0);
                json.dump(existing_data, file, indent=4);
                file.truncate();
        else:
            # overwrite file with new data
            with open(file_name, "w") as file:
                json.dump([log_entry], file, indent=4);
    except Exception as e:
        print(f"error writing to {file_name}: {e}");

def compare_solutions(solutions1, solutions2):
    """
    Compares solution paths to returns if they are the same.
    """
    # extract paths from solutions
    paths1 = {solution[0] for solution in solutions1};
    paths2 = {solution[0] for solution in solutions2};

    # compare paths
    return paths1 == paths2;

def get_puzzle_from_user():
    """
    Prompt the user to enter vehicle positions in the right format.
    """

    print("\nPaste puzzle vehicles (spaces/newlines allowed), after pasting, press Ctrl+D (Linux/MacOS) or Ctrl+Z + Enter (Windows) to finish:\n")

    # get full input in one go
    user_input = sys.stdin.read().strip().upper()

    # remove all spaces + newlines
    user_input = "".join(user_input.split())

    # check if length is multiple of 4
    if len(user_input) % 4 != 0:
        print("Invalid input length, Each vehicle entry must be 4 chars long.")
        return get_puzzle_from_user()

    puzzle_data = [];
    is_valid = True;

    for i in range(0, len(user_input), 4):
        # extract 4 chars chunk
        chunk = user_input[i:i+4] 
        # unpack
        model, x, y, orientation = chunk[0], chunk[1], chunk[2], chunk[3];

        # check model (must be A-Z)
        if model not in "ABCDEFGHIJKOPQRX":
            print(f"Invalid model '{model}' in '{chunk}'. Use a letter in 'ABCDEFGHIJKOPQRX'.");
            is_valid = False;
            break;

        # check x and y
        if not x.isdigit() or not y.isdigit() or not (0 <= int(x) < 6) or not (0 <= int(y) < 6):
            print(f"Invalid coordinates '{x}{y}' in '{chunk}'. It should be between 0-5.");
            is_valid = False;
            break;

        # check orientation
        if orientation not in ["H", "V"]:
            print(f"Invalid orientation '{orientation}' in '{chunk}'. It should be 'H' or 'V'.");
            is_valid = False;
            break;

        # convert x & y to int and append
        puzzle_data.append((model, int(x), int(y), orientation));

    # return the valid state
    if is_valid:
        return initialize_state(puzzle_data);

    print("Incorrect format, re-enter the vehicles correctly.\n") 
    return get_puzzle_from_user()  # restart since invalid

def get_puzzle(file_number, folder="boards", file_name=None):
    """
    Reads a puzzle file from the file parses it into a RushHour format.
    """
    # get file path
    if not file_name:
        file_path = os.path.join(folder, str(file_number));
    else: 
        file_path = file_name;
    
    if not os.path.exists(file_path):
        if not file_name:
            raise FileNotFoundError(f"Puzzle file {file_number} not found in folder '{folder}'");
        else:
            raise FileNotFoundError(f"Puzzle {file_name} not found");
    
    puzzle_data = [];
    
    # open file
    with open(file_path, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip();
            if len(line) == 4:
                model = line[0];
                x = int(line[1]);
                y = int(line[2]);
                orientation = line[3];
                puzzle_data.append((model, x, y, orientation));
            else:
                raise ValueError(f"Invalid format in puzzle file {file_number}: {line}");
    
    return initialize_state(puzzle_data);

def initialize_state(state):
    """
    Inits a state into the correct RushHour format.
    """
    new_state = [];
    
    # paint vehicle frame
    for vehicle in state:

        model, x, y, orientation = vehicle;

        # for car
        if model in ["X", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]:
            
            # for horizontal
            if orientation == "H":
                # paint right
                new_state.append((model, 
                                  [(x, y), 
                                   (x + 1, y)],
                                  orientation));

            # for verticle
            elif orientation == "V":
                # paint down
                new_state.append((model, 
                                  [(x, y), 
                                   (x, y + 1)],
                                  orientation) );
        
        # for truck
        elif model in ["O", "P", "Q", "R"]:

            # for horizontal
            if orientation == "H":
                # paint right
                new_state.append((model, 
                                  [(x, y), 
                                   (x + 1, y), 
                                   (x + 2, y)],
                                  orientation) );

            # for verticle
            elif orientation == "V":
                # paint down
                new_state.append((model, 
                                  [(x, y), 
                                   (x, y + 1), 
                                   (x, y + 2)],
                                  orientation) );
    new_state = tuple(new_state);
    return new_state;

def compare_rush_hour_results(bfs_file, best_h1_file, best_h2_file, best_h3_file, output_file="results.json"):
    """
    Compares BFS, BestFS(h1), BestFS(h2), and BestFS(h3) results and write a summary.
    """
    
    # check bfs file exists
    if not os.path.exists(bfs_file):
        raise FileNotFoundError(f"BFS file '{bfs_file}' not found :(");

    # load BFS data
    with open(bfs_file, 'r') as f:
        bfs_results = json.load(f);

    # load heuristic files
    h1_results = None;
    h2_results = None;
    h3_results = None;

    if os.path.exists(best_h1_file):
        with open(best_h1_file, 'r') as f:
            h1_results = json.load(f);

    if os.path.exists(best_h2_file):
        with open(best_h2_file, 'r') as f:
            h2_results = json.load(f);

    if os.path.exists(best_h3_file):
        with open(best_h3_file, 'r') as f:
            h3_results = json.load(f);

    # ensure we are comparing the same puzzles
    puzzle_comparisons = [];
    
    for i in range(len(bfs_results)):  
        bfs = bfs_results[i]["summary"];
        puzzle_number = bfs["puzzle_number"];

        # build comparison entry with BFS data
        comparison_entry = {
            "puzzle_number": puzzle_number,
            "matching_solutions": {
                "depth": bfs["solution_depth"],
                "time_taken": {
                    "bfs": bfs["time_taken"]
                },
                "unique_states": {
                    "bfs": bfs["unique_states"]
                },
                "is_admissible": {},
                "solution_paths": {
                    "bfs": bfs["path_to_1st_solution"]
                }
            }
        }

        # process heuristics that exist
        if h1_results:
            h1 = h1_results[i]["summary"];
            comparison_entry["matching_solutions"]["time_taken"]["h1"] = h1["time_taken"];
            comparison_entry["matching_solutions"]["unique_states"]["h1"] = h1["unique_states"];
            comparison_entry["matching_solutions"]["is_admissible"]["h1"] = h1["is_admissible"];
            comparison_entry["matching_solutions"]["solution_paths"]["h1"] = h1["path_to_1st_solution"];

        if h2_results:
            h2 = h2_results[i]["summary"];
            comparison_entry["matching_solutions"]["time_taken"]["h2"] = h2["time_taken"];
            comparison_entry["matching_solutions"]["unique_states"]["h2"] = h2["unique_states"];
            comparison_entry["matching_solutions"]["is_admissible"]["h2"] = h2["is_admissible"];
            comparison_entry["matching_solutions"]["solution_paths"]["h2"] = h2["path_to_1st_solution"];

        if h3_results:
            h3 = h3_results[i]["summary"];
            comparison_entry["matching_solutions"]["time_taken"]["h3"] = h3["time_taken"];
            comparison_entry["matching_solutions"]["unique_states"]["h3"] = h3["unique_states"];
            comparison_entry["matching_solutions"]["is_admissible"]["h3"] = h3["is_admissible"];
            comparison_entry["matching_solutions"]["solution_paths"]["h3"] = h3["path_to_1st_solution"];

        puzzle_comparisons.append(comparison_entry);

    # Write to output file
    with open(output_file, 'w') as f:
        json.dump(puzzle_comparisons, f, indent=4);

def print_solution_from_file(filename):
    """
    Read JSON file and print solution found
    """

    # check if file exists
    if not os.path.exists(filename):
        print(f"Error: File '{filename}' not found.");
        return;

    # load data
    with open(filename, "r") as f:
        try:
            data = json.load(f);
        except json.JSONDecodeError:
            print(f"Error: Could not parse JSON from '{filename}'.");
            return;

    # get solutions
    try:
        solution_path = data[0]["summary"]["path_to_1st_solution"]
    except (KeyError, IndexError):
        print(f"Error: Solution not found in '{filename}'.");
        return;

    # print
    for i in range(0, len(solution_path), 2):
        print(solution_path[i:i+2]+"\n");


if __name__ == "__main__":
    # set up args parsing
    parser = argparse.ArgumentParser(
        description="Run Rush Hour Search Problem with BFS, DFS, or both",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "algorithm",
        nargs="+",
        choices=["bfs", "bestFS"],
        help="search algorithm to use (bfs, bestFS, or both)"
    )
    parser.add_argument(
        "--h",
        nargs="+",
        choices=["h1", "h2", "h3"],
        help="Heuristic function for BestFS (both can be applied):\n"
             " h1: Distance of the red car 'X' to the target.\n"
             " h2: Distance of 'X' to the goal + Number of blocking cars in the way.\n"
             " h3: Distance of 'X' to the goal + cost to move blocking cars."
    )
    parser.add_argument(
        "--file",
        type=str,
        help="Specify a puzzle file to load and run (e.g., 'puzzle1.txt' or 'boards/puzzle1.txt').\n"
    )
    parser.add_argument(
        "-loop",
        action="store_true",
        default=False,
        help="run algorithm on 40 Rush Hour Puzzles"
    )
    
    args = parser.parse_args();

    # ensure heuristic is specified only when BestFS is chosen
    if "bestFS" in args.algorithm and not args.h:
        parser.error("The --heuristic argument is required when using bestFS.")
    
    # execute the algorithms based on the argument
    if args.algorithm:

        # delete files
        files_to_delete = ["results.json", "bfs_results.json", "h1_results.json", "h2_results.json", "h3_results.json"];
        for file in files_to_delete:
            if os.path.exists(file):
                os.remove(file);

        file_name = None;

        # set loop
        if args.loop:
            loop = 40;
            print("Running on 40 Puzzles...");
        else:
            loop = 1;
            if args.file:
                file_name = args.file;

        # run algorithm 
        for i in range(loop):

            # get start state 
            problem_type= "Rush Hour Problem";
            result_file_name = "results.json"
            if loop == 1:
                if args.file:
                    start_state = get_puzzle(file_number=i+1, file_name=file_name);
                else:
                    start_state = get_puzzle_from_user();
            else:
                start_state = get_puzzle(file_number=i+1, file_name=file_name);

            
            problem = RushHour(state=start_state);

            # initialize variables for solutions & visited states
            heuristic_used = None;
            solutions = [];
            time_taken = None;
            visited = 0;
            unique = 0;
            unique_dictionary = {};
            visited_dictionary = {};
        
            for algo in args.algorithm:
                
                # run bfs
                if algo == "bfs":
                    
                    reset_search_problem();

                    # log time
                    time_taken = time.time();
                    problem.bfs();
                    time_taken = time.time() - time_taken;
                    
                    # save
                    result_file_name = "bfs_results.json";
                    visited_dictionary = SearchProblem.visited_dictionary;
                    unique_dictionary = SearchProblem.unique_dictionary;
                    unique = len(SearchProblem.unique);
                    solutions = SearchProblem.unique_solutions;
                    visited = SearchProblem.num_visited;
                    admissabiity = None;

                    # determine whether to append to the file
                    append = False if i == 0 else True;
                
                    # log solutions
                    write_solutions( problem_type=problem_type,
                                    puzzle_number=(file_name if file_name else i+1),
                                    algorithm=algo,
                                    heuristic=heuristic_used,
                                    solutions=solutions,
                                    start_state=start_state,
                                    max_depth=None,
                                    unique_dictionary=unique_dictionary,
                                    visited_dictionary=visited_dictionary,
                                    time_taken=time_taken,
                                    unique=unique,
                                    visited=visited,
                                    admissability=None,
                                    file_name=result_file_name,
                                    append=append
                                    );
                # run bfs
                if algo == "bestFS":

                    for heuristic in args.h:
                        
                        reset_search_problem();

                        # log time
                        time_taken = time.time();
                        problem.bestFS(heuristic=heuristic);
                        time_taken = time.time() - time_taken;
                        
                        # save
                        result_file_name = str(heuristic) + "_results.json";
                        heuristic_used = heuristic;
                        unique_dictionary = SearchProblem.unique_dictionary;
                        visited_dictionary = SearchProblem.visited_dictionary;
                        unique = len(SearchProblem.unique);
                        solutions = SearchProblem.unique_solutions;
                        visited = SearchProblem.num_visited;
                        admissability = SearchProblem.admissability;
                    
                        # determine whether to append to the file
                        append = False if i == 0 else True;
                
                        # log solutions
                        write_solutions( problem_type=problem_type,
                                        puzzle_number=(file_name if file_name else i+1),
                                        algorithm=algo,
                                        heuristic=heuristic_used,
                                        solutions=solutions,
                                        start_state=start_state,
                                        max_depth=None,
                                        unique_dictionary=unique_dictionary,
                                        visited_dictionary=visited_dictionary,
                                        time_taken=time_taken,
                                        unique=unique,
                                        visited=visited,
                                        admissability=admissability,
                                        file_name=result_file_name,
                                        append=append
                                        );
        if len(args.algorithm) > 1:
            compare_rush_hour_results("bfs_results.json", "h1_results.json", "h2_results.json", "h3_results.json");
            print("Search completed, solutions saved in results.json\n");
        else:
            if 'bfs' in args.algorithm:
                print_solution_from_file(result_file_name);
            elif len(args.h) == 1:
                print_solution_from_file(result_file_name);

