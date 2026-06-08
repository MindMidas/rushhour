from src.solver.SearchProblem import SearchProblem, Edge
    
def is_truck(model):
    return model in ["O", "P", "Q", "R"];

def is_car(model):
    return model in ["X", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];

def is_horizontal(orientation):
    return orientation == "H";

def is_vertical(orientation):
    return orientation == "V";

def is_valid(frame):
    """
    Check if vehicle frame is in grid.
    """
    
    # iterate over pos in frames
    for x, y in frame:

        # check if pos invalid
        if not (0 <= x < 6 and 0 <= y < 6):

            return False;
    
    # pos valid
    return True;

def move_left(vehicle):
    """
    Move vehicle left.
    """
    
    model, frame, orientation = vehicle;

    # check if vehicle horizontal
    if is_horizontal(orientation):

        # set new frame to left move
        new_frame = [(x - 1, y) for x, y in frame];
        return (model, new_frame, orientation);
    
    return None;

def move_right(vehicle):
    """
    Move vehicle right.
    """

    model, frame, orientation = vehicle;

    # check if vehicle horizontal
    if is_horizontal(orientation):

        # set new frame to right move
        new_frame = [(x + 1, y) for x, y in frame];
        return (model, new_frame, orientation);

    return None;

def move_up(vehicle):
    """
    Move the vehicle up.
    """

    model, frame, orientation = vehicle;

    # check if vehicle verticle
    if is_vertical(orientation):

        # set new frame to up move
        new_frame = [(x, y - 1) for x, y in frame];
        return (model, new_frame, orientation);

    return None;

def move_down(vehicle):
    """
    Move the vehicle down.
    """

    model, frame, orientation = vehicle;

    # check if vehicle verticle
    if is_vertical(orientation):

        # set new frame to down move
        new_frame = [(x, y + 1) for x, y in frame];
        return (model, new_frame, orientation);

    return None;

def is_left(vehicle1, vehicle2):
    """
    Check if vehicle2 is on the left side of vehicle1.
    """
    v1_x = vehicle1[1][0][0];
    v2_x = vehicle2[1][0][0];

    return v2_x < v1_x;

def is_above(vehicle1, vehicle2):
    """
    Check if vehicle2 is above vehicle1.
    """

    v1_x = vehicle1[1][0][1];
    v2_x = vehicle2[1][0][1];

    return v2_x < v1_x;

class RushHour(SearchProblem):
    """
    Subclass of SearchProblem. Implements logic for the  Rush Hour Problem.
    """
    
    colors_mapped = {
        "X": "\033[91m", "A": "\033[92m", "B": "\033[93m", "C": "\033[94m", "D": "\033[95m", "E": "\033[96m",
        "F": "\033[32m", "G": "\033[90m", "H": "\033[97m", "I": "\033[93m", "J": "\033[90m", "K": "\033[32m",
        "O": "\033[93m", "P": "\033[95m", "Q": "\033[94m", "R": "\033[32m", "e": "\033[97m"
    }
    
    def __init__(self, state):
        """
        Constructor function which initializes the start state
        and the path. 

        The tuple 'state' represents the positions of each vehicle
        on the 6x6 board, where the 1st item is the vehicle model,
        the 2nd and 3rd item is the left most position of the vehicle,
        the 4th item is the orientation of the vehicle horizontal or 
        verticle.
        
        Represented in the following form (x and y pos):
        ( ((0,0), (1,0), (2,0), (3,0), (4,0), (5,0)),
          ((0,1), (1,1), (2,1), (3,1), (4,1), (5,1)),
          ((0,2), (1,2), (2,2), (3,2), (4,2), (5,2)),
          ((0,3), (1,3), (2,3), (3,3), (4,3), (5,3)),
          ((0,4), (1,4), (2,4), (3,4), (4,4), (5,4)),
          ((0,5), (1,5), (2,5), (3,5), (4,5), (5,5)), )
        
        Example: ( ("A", 0, 0, "H"), 
                   ("P", 0, 1, "V"),
                   ("B", 0, 4, "V"),
                   ("X", 1, 2, "H"),
                   ("Q", 3, 1, "V"),
                   ("R", 2, 5, "H"),
                   ("C", 4, 4, "H"),
                   ("O", 5, 0, "V")))

        6x6 board: ( ("A", "A", "e", "e", "e", "O"),
                     ("P", "e", "e", "Q", "e", "O"),
                     ("P", "X", "X", "Q", "e", "O"),
                     ("e", "e", "e", "Q", "e", "e"),
                     ("B", "e", "e", "e", "C", "C"),
                     ("B", "e", "R", "R", "R", "e")) )
    
        Each letter here represents the corresponding car/truck,
        "A" represents Light Green Car, "O" represents Orange Truck, and so on.
        "e" is the empty spot, which has no car on it.

        """
        
        self.state = state;
        self.path = "";

    def print_board(self):
        board = [["e" for _ in range(6)] for _ in range(6)];
        for vehicle in self.state:
            for x, y in vehicle[1]:
                board[y][x] = vehicle[0];
        
        for row in board:
            print(" ".join([f"{RushHour.colors_mapped[cell]}{cell}\033[0m" for cell in row]));
    
    def __lt__(self, other):
        return False  # needed to prevent heapq errors
    
    def is_obstructed(self, vehicle):
        """
        Check if the new vehicle frame overlaps with any existing vehicle frames.
        """

        model1 = vehicle[0];
        frame1 = vehicle[1];

        # iterate over self vehicle position in frames
        for pos in frame1:
            
            # iterate over vehicles in state
            for other_vehicle in self.state:

                model2 = other_vehicle[0];
                frame2 = other_vehicle[1];

                # found obstruction and ignored current vehicle
                if model1 != model2 and pos in frame2:
                    return True, other_vehicle;
        
        # no obstructions
        return False, False;

    def get_x_car(self):
        """
        Returns the red car.
        """
        # iterate over vehicles
        for vehicle in self.state:

            model, _, _ = vehicle;

            # find the X car
            if model == "X":
                return vehicle; # return X car
        
        return None; # not found
    
    def get_dist_to_target(self, x_car):
        """
        Returns the distance of the X car to the exit.
        """
        return 4 - x_car[1][0][0];
            
    def get_total_blocking_x(self, x_car):
        """
        Returns the number of vehicles in path of X car.
        """

        blocking_vehicles = 0;

        #unpack
        _, x_frame, _ = x_car;
    
        x_x2, x_y2 = x_frame[1];

        # Count blocking vehicles
        for vehicle in self.state:
            
            #unpack
            v_model, v_frame, _ = vehicle;
            
            # ignore X car
            if v_model != "X":
                
                # check if blocking X path
                for v_x, v_y in v_frame:
                    if v_x > x_x2 and v_y == x_y2:
                        blocking_vehicles += 1; # increment blocking cars

        return blocking_vehicles;

    def get_cost_to_move_vehicles_blocking_x(self, x_car):
        """
        Returns the cost to move vehicles blocking the x car in front.
        """

        cost = 0;

        # unpack
        model, frame, _ = x_car;

        # car front
        x_x2, x_y2 = frame[1];

        # get vehicles blocking
        for other_vehicle in self.state:
            # unpack
            other_model, other_frame, _ = other_vehicle;

            # skip current vehicle
            if other_model != model:

                # iterate over frame
                for other_x, other_y in other_frame:
                    
                    # check front
                    if other_x > x_x2 and other_y == x_y2:
                        cost += self.get_cost_to_clear_path(x_car, other_vehicle);
                        break;
            
        return cost;

    def get_cost_to_clear_path(self, vehicle1, vehicle2):
        """
        Returns the number of min number of moves vehicle2 must make to clear the path for vehicle1 (moving up or down).
        """

        front_moves = float("inf");
        back_moves = float("inf");

        # unpack
        _, v1_frame, _ = vehicle1;
        v2_model, v2_frame, _ = vehicle2;
            
        # calculate number of moves to clear the path of vehicle1 going up based on car or truck
        if is_truck(v2_model) and v2_frame[0][1] == v1_frame[0][1]:
            back_moves = float("inf");
        elif is_truck(v2_model) and v2_frame[1][1] == v1_frame[0][1]:
            back_moves = float("inf");
        elif is_truck(v2_model) and v2_frame[2][1] == v1_frame[0][1]:
            back_moves = float("inf");
        elif is_car(v2_model) and v2_frame[0][1] == v1_frame[0][1]:
            back_moves = 2;
        elif is_car(v2_model) and v2_frame[1][1] == v1_frame[0][1]:
            back_moves = 1;
        
        # calculate number of moves to clear the path of vehicle1 going down based on car or truck
        if is_truck(v2_model) and v2_frame[2][1] == v1_frame[0][1]:
            front_moves = 3;
        elif is_truck(v2_model) and v2_frame[1][1] == v1_frame[0][1]:
            front_moves = 2;
        elif is_truck(v2_model) and v2_frame[0][1] == v1_frame[0][1]:
            front_moves = 1;
        elif is_car(v2_model) and v2_frame[1][1] == v1_frame[0][1]:
            front_moves = 2;
        elif is_car(v2_model) and v2_frame[0][1] == v1_frame[0][1]:
            front_moves = 1;

        return min(back_moves, front_moves);
    
    def heuristic_1(self):
        """
        Heuristic 1, distance of red car to target.
        """

        # return 0 if target
        if self.is_target():
            return 0;

        # get h(n) val1: distance to target
        x_car = self.get_x_car();

        return self.get_dist_to_target(x_car);

    def heuristic_2(self):
        """
        Heuristic 2, distance of red car to target + total number of blocking cars.
        """

        # return 0 if target
        if self.is_target():
            return 0;

        # get h(n) val1: distance to target
        x_car = self.get_x_car();

        return self.get_dist_to_target(x_car) + self.get_total_blocking_x(x_car);
          
    def heuristic_3(self):
        """
        Heuristic 3, distance of red car to target + cost to move blocking cars
        """

        # return 0 if target
        if self.is_target():
            return 0;

        # get h(n) val1: distance to target
        x_car = self.get_x_car();

        cost = self.get_dist_to_target(x_car);

        cost += self.get_cost_to_move_vehicles_blocking_x(x_car);
        
        return cost;
    
    def edges(self):
        """
        Generate all valid states from the current state.
        
        An edge represents the next possible move.
        
        This method returns a list of valid state objects.
        """

        valid_states = []; # valid states generated
    
        # check for solution
        if self.is_target():
            return valid_states;
    
        # loop over vehicles
        for vehicle in self.state:

            # loop over moves
            for move in ["L", "R", "U", "D"]:

                # convert tuple to list
                new_state = [list(row) for row in self.state]
                
                # init new vehicle 
                new_vehicle = None;
                
                # Try moving the vehicle in the respective direction
                if is_horizontal(vehicle[2]) and move == "L":
                    new_vehicle = move_left(vehicle);
                
                elif is_horizontal(vehicle[2]) and move == "R":
                    new_vehicle = move_right(vehicle);
                
                elif is_vertical(vehicle[2]) and move == "U":
                    new_vehicle = move_up(vehicle);
                
                elif is_vertical(vehicle[2]) and move == "D":
                    new_vehicle = move_down(vehicle);
                
                # exhausted moves
                else:
                    continue;
        
                # new vehicle pos valid and not obstructed
                if new_vehicle and is_valid(new_vehicle[1]):
                    
                    obstructed, _ = self.is_obstructed(new_vehicle);
                    
                    if not obstructed:
                        # update the new state to reflect new vehicle pos frame
                        for other_vehicle in new_state:
                            
                            # search for vehicle and update pos
                            if other_vehicle[0] == new_vehicle[0]:
                                other_vehicle[1] = new_vehicle[1];
                        
                        valid_states.append(Edge(self, new_vehicle[0] + move, RushHour(tuple((vehicle[0], vehicle[1], vehicle[2]) for vehicle in new_state))));
        
        return valid_states;

    def is_target(self):
        """
        Check if target state achieved.
        """
        # Find the red car "X"
        for vehicle in self.state:
            if vehicle[0] == "X":  
                if (4, 2) in vehicle[1] and (5, 2) in vehicle[1]:  # check if at exit
                    return True;
        return False;
