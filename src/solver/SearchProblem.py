import time
import heapq

class SearchProblem:
  """
  This class represents the superclass for a search problem.
  
  The class itself rerpresents a specific search problem
  (graph), while instances of the class represent states
  (nodes) of the problem.

  Programmers should subclass this superclass filling in
  specific versions of the methods that are stubbed below.
  """

  stop = False;	# class variable to end search - single variable 
                # accessible to all instances of the class

  visited = [];	# class variable that holds the states visited
                # along the path to the current node - used to
                # avoid loops

  unique = set(); # class variable that holds unique states
                      # visited by a search

  depth = 0;  # class variable that holds the depth the dfs has
              # reached, used to avoid exceeding max recursion
              # depth

  max_depth = 18;    # Variable used to specify maximum depth
                     # to search

  continue_search = False;
                # Variable to determine if the search algorithm is to
                # continue to search for more solutions after it has found
                # one

  unique_solutions = []; # list of unique solutions
  
  num_visited = 0; # track num visited
  
  start_time = 0; # timer
  
  started = False; # keep track of started or not
  
  visited_dictionary = {}; # dictionary for depth and total states visited
  
  unique_dictionary = {}; # dictionary for depth and unique states visited

  visited_vehicles = []; # track visited vehicles for heuristic
  
  front_moves_visited = []; # track visited vehicles for front moves heuristic
  
  back_moves_visited = []; # track visited vehicles for back moves heuristic

  recursive_depth = 0;

  admissability = [];

  deadline = None;

  timed_out = False;

  cancelled = False;

  stop_reason = None;


  def __init__( self, state=None ):
    """
    Stub
    Constructor function for a search problem.

    Each subclass should supply a constructor method that can
    operate with no arguments other than the implicit "self"
    argument to create the start state of a problem.

    It should also supply a constructor method that accepts a
    "state" argument containing a string that represents an
    arbitrary state in the given search problem.

    It should also initialize the "path" member variable to a
    (blank) string.
    """
    raise NotImplementedError("__init__");

  def edges( self ):
    """
    Stub
    This method must supply a list or iterator for the Edges
    leading out of the current state.
    """
    raise NotImplementedError("edges");

  def is_target( self ):
    """
    Stub
    This method must return True if the current state is a goal
    state and False otherwise.
    """

    raise NotImplementedError("is_target");

  def __repr__( self ):
    """
    This method must return a string representation of the
    current state which can be "eval"ed to generate an instance
    of the current state.
    """

    return self.__class__.__name__ + "( " + repr(self.state) + \
    ")";

  def target_found( self ):
    """
    This method is called when the target is found.

    By default it prints out the path that was followed to get
    to the current state.
    """
    
    elapsed_time = time.time() - SearchProblem.start_time;
    
    SearchProblem.unique_solutions.append((str(self.path), 
                                           SearchProblem.depth, 
                                           SearchProblem.num_visited,
                                           len(SearchProblem.unique),
                                           elapsed_time,));

  def should_stop():
    """
    Check shared search stop conditions.
    """

    if SearchProblem.stop:
      return True;

    if SearchProblem.deadline is not None and time.perf_counter() >= SearchProblem.deadline:
      SearchProblem.stop = True;
      SearchProblem.timed_out = True;
      SearchProblem.stop_reason = "timeout";
      return True;

    return False;
      
  def add_to_dictionaries(curr_state):
    """
    Ensure current search depth in unique and visited dictionary.
    Checks if current state is unique or visited and updates the dictionaries.
    """

    # add depth to dictionary
    if SearchProblem.depth not in SearchProblem.visited_dictionary:
      SearchProblem.visited_dictionary[SearchProblem.depth] = 0;
    
    if SearchProblem.depth not in SearchProblem.unique_dictionary:
      SearchProblem.unique_dictionary[SearchProblem.depth] = 0;
    
    # add to unique and increment num unique states at depth
    if repr(curr_state.state) not in SearchProblem.unique:
      SearchProblem.unique.add(repr(curr_state.state));
      SearchProblem.unique_dictionary[SearchProblem.depth] += 1;
    
    # increment num states visited at depth
    SearchProblem.visited_dictionary[SearchProblem.depth] += 1;
    
    # increment num states visited
    SearchProblem.num_visited += 1;
  
  def dfs( self, max_depth=None, continue_search=None ):
    """
    Perform a depth first search originating from the node,
    "self".
    Recursive method.
    """

    # record the start time
    SearchProblem.start_time = time.time();
    SearchProblem.started = True;
    
    if continue_search is not None:
      SearchProblem.continue_search = continue_search;
    
    SearchProblem.max_depth = max_depth;

    start_repr = repr(self.state);
    stack = [(self, set([start_repr]), 0, self.path)];

    while stack:
      if SearchProblem.should_stop():
        return;

      curr_state, path, SearchProblem.depth, path_string = stack.pop();
      curr_repr = repr(curr_state.state);

      if curr_repr in SearchProblem.unique:
        continue;

      if SearchProblem.max_depth is not None and SearchProblem.depth > SearchProblem.max_depth:
        continue;

      curr_state.path = path_string;
      SearchProblem.add_to_dictionaries(curr_state=curr_state);

      if curr_state.is_target():
        curr_state.target_found();

        if not SearchProblem.continue_search:
          return;

      for action in reversed(curr_state.edges()):
        if SearchProblem.should_stop():
          return;

        destination_repr = repr(action.destination.state);

        if destination_repr in path or destination_repr in SearchProblem.unique:
          continue;

        action_path = path.copy();
        action_path.add(destination_repr);
        action.destination.path = curr_state.path + " " + str(action.label);
        stack.append((action.destination, action_path, SearchProblem.depth + 1, action.destination.path));

  def bfs( self, max_depth=None, continue_search=None ):
    """
    Perform a breadth-first search (BFS) up to a specified depth.
    max_depth: The maximum depth to search.
    """
    
    if continue_search:
      SearchProblem.continue_search = continue_search;
      
    # if max_depth:
    #   SearchProblem.max_depth = max_depth;
    
    # record the start time
    SearchProblem.start_time = time.time();
    
    # add first state to visited
    start_state = set();
    start_state.add(repr(self.state))

    # set queue on first call
    queue = [(self, start_state, 0)];

    while queue:
      if SearchProblem.should_stop():
        return;
      
      # pop first element in the queue and set variables
      curr_state, path, SearchProblem.depth = queue.pop(0);
      
      # skip if visited
      if repr(curr_state.state) in SearchProblem.unique:
        continue;
      
      # # stop searching if max depth reached
      # if SearchProblem.depth > SearchProblem.max_depth:
      #   return;
      
      # Add the current depth and state to unique and visited
      SearchProblem.add_to_dictionaries(curr_state);
      
      # check if current state is target
      if curr_state.is_target():
        
        # log solution
        curr_state.target_found();
        
        # exit if continue_search is false
        if not SearchProblem.continue_search:
          return;
      
      # consider each edge leading out of current node
      for action in curr_state.edges():
        if SearchProblem.should_stop():
          return;
        
        # looping path ignore
        if repr(action.destination.state) not in path:
        
            # copy current_state path and add current_state to path 
            action_path = path.copy();
            action_path.add(repr(action.destination.state));
            
            # set action label to current path + action label
            action.destination.path = curr_state.path + str(action.label);

            # append new state to queue
            queue.append((action.destination, action_path, SearchProblem.depth + 1));
  
  def bestFS(self, heuristic=None, max_depth=None, continue_search=None):
    """
    Best-first search using heuristic
    - heuristic="h1" uses heuristic_1()
    - heuristic="h2" uses heuristic_2()
    """

    if continue_search:
      SearchProblem.continue_search = continue_search;
      
    # if max_depth:
    #   SearchProblem.max_depth = max_depth;
    
    # record the start time
    SearchProblem.start_time = time.time();

    # initialize queue
    queue = [];

    # calc heuristic cost
    if heuristic == "h1":
      heuristic_val = self.heuristic_1();
    elif heuristic == "h2":
      heuristic_val = self.heuristic_2();
    else:
      heuristic_val = self.heuristic_3();

    # add first state to visited
    start_state = set();
    start_state.add(repr(self.state))

    # push to queue
    heapq.heappush(queue, (heuristic_val, 0, self, start_state));
    
    # loop over queue 
    while queue:
      if SearchProblem.should_stop():
        return;
      
      
      # pop and unpack based on heuristics
      hue, SearchProblem.depth, curr_state, path = heapq.heappop(queue);
      
      # skip if visited
      if repr(curr_state.state) in SearchProblem.unique:
        continue;
      
      # check for max depth
      # if SearchProblem.depth > SearchProblem.max_depth:

      #   # continue searching if a path isn't found and queue not empty
      #   if len(queue) > 0:
      #     continue;
      #   else:
      #     return; # search space exhausted
    
      # Add the current depth and state to unique and visited
      SearchProblem.add_to_dictionaries(curr_state);

      # check if current state is target
      if curr_state.is_target():
        # log solution
        curr_state.target_found();

        # exit if continue_search is false
        if not SearchProblem.continue_search:
          return;
      
      # consider each edge leading out of current node
      for action in curr_state.edges():
        if SearchProblem.should_stop():
          return;

        # only add non looping paths to queue
        if repr(action.destination.state) not in path:
          
          # copy current_state path and add current_state to path 
          action_path = path.copy();
          action_path.add(repr(action.destination.state));

          # set action label to current path + action label
          action.destination.path = curr_state.path + str(action.label);
          
          # calc heuristic cost
          if heuristic == "h1":
            heuristic_val = action.destination.heuristic_1();
          elif heuristic == "h2":
            heuristic_val = action.destination.heuristic_2();
          else:
            heuristic_val = action.destination.heuristic_3();
          
          SearchProblem.admissability.append((heuristic_val, SearchProblem.depth + 1))
          heapq.heappush(queue, (heuristic_val + SearchProblem.depth + 1, SearchProblem.depth + 1, action.destination, action_path));

class Edge:
  """
  This class represents an edge between two nodes in a
  SearchProblem.
  Each edge has a "source" (which is a subclass of
  SearchProblem), a "destination" (also a subclass of
  SearchProblem) and a text "label".
  """

  def __init__( self, source, label, destination ):
    """
    Constructor function assigns member variables "source",
    "label" and "destination" as specified.
    """
    self.source = source;
    self.label = label;
    self.destination = destination;

  def __repr__( self ):
    return "Edge(" + repr( self.source ) + "," + \
                     repr( self.label ) + "," + \
                     repr( self.destination ) + ")";