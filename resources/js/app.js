// Find which lines have mutations on them
function getMutatedLines(codeMirror, fileName = null, clicks = true, operatorType = null)
{
    if (fileName === null)
    {
        var fileName = location.search.substring(1);
    }

    var jsonName;

    if (operatorType != null && operatorType != 'line')
    {
        jsonName = fileName + '-operators.json?x';
    }
    else
    {
        jsonName = fileName + '-mutants.json';
    }


    $.getJSON('../data/' + jsonName, function(data)
    {
        var totalMutants = 0;
        var mutatedLines = {};

        // Alternate intensity highlighting: keep track of largest,
        // intensity = val.mutants/largest
        // More proportional, but one with 100% is difficult to read

        if (operatorType == null || operatorType == 'line')
        {
            $.each(data, function(key, val)
            {
                totalMutants += val.mutants;
            });

            $.each(data, function(key, val)
            {
                var intensity = parseFloat(val.mutants/totalMutants);

                mutatedLines[key] = [0, null, intensity];
            });
        }
        else
        {
            var opMutants = {};

            if (operatorType != 'all')
            {
                // Want one type only
                var details      = data[operatorType];
                var totalMutants = details.mutants;

                $.each(details.lines, function(key, val)
                {
                    mutatedLines[val] = [0, null, 1];
                });
            }
            else
            {
                $.each(data, function(key, val)
                {
                    totalMutants += val.mutants;

                    if (opMutants[key] == null)
                    {
                        opMutants[key] = val.mutants;
                    }
                    else
                    {
                        opMutants[key] += val.mutants;
                    }
                });

                $.each(data, function(key, val)
                {
                    var intensity = parseFloat(opMutants[key]/totalMutants);

                    $.each(val.lines, function(key, val)
                    {
                        if (mutatedLines[val] != null)
                        {
                            mutatedLines[val][2] += intensity;
                        }
                        else
                        {
                            mutatedLines[val] = [0, null, intensity];
                        }
                    });
                });
            }
        }

        markLines(mutatedLines, codeMirror, 'red');

        if(clicks)
        {
            enableClicks(fileName);
        }
    });

    return;
}
	
// Mark mutated lines
function markLines(mutatedLines, codeMirror, colour)
{
	var markOptions = {
		className: 'mutants',
		atomic: true,
		readOnly: true
	};

        var rgba;

        switch (colour)
        {
            case 'green':
                rgba = '0, 255, 0';
                break;
            case 'yellow':
                rgba = '255, 255, 0';
                break;
            default:
                rgba = '255, 0, 0';
                break;
        }

	$.each(mutatedLines, function(index)
	{
		// Internally CM indexes from line 0
		// Visually from 1
		var line       = parseInt(index)-1;
		var characters = this.slice(0, 1);
                var intensity  = this.slice(-1);
			
		var begin = {
			line: line,
			ch: characters[0]
		};
				
		var end = {
			line: line,
			ch: characters[1]
		};

                markOptions['css'] = 'background: rgba(' + rgba + ', ' + intensity + ');';
				
		var marked = codeMirror.markText(begin, end, markOptions);
	});
			
	return;
}

// Read in local file to put content in editor
function readFile(filePath, callback, mutantText)
{
	var file         = new XMLHttpRequest();
	var fileContents = '';
			
	file.open('GET', filePath);
	
	file.onreadystatechange = function()
	{
		if (file.readyState !== XMLHttpRequest.DONE)
		{
			return;
		}
				
		if (file.status !== 200)
		{
			return;
		}
				
		// Successfully retrieved file
		callback(file.responseText, mutantText);
	}
			
	file.send(null);			
}

// Create a new code mirror editor from textarea with ID textareaId, containing fileContents
function createCodeEditor(textareaId, fileContents)
{	
	var textarea = $('#' + textareaId)[0];
	var options = {
		lineNumbers: true,
		mode: 'ruby',
		autoRefresh: true,
                viewportMargin: Infinity
	}
	
	var codeMirror = CodeMirror.fromTextArea(textarea, options);

	codeMirror.setValue(fileContents);
	
	return codeMirror;
}

// Add new accordion to file list
function createAccordion(fileName, fileIndex, fileScore, mutantsSurvived)
{
    var lastRow          = $('.row').last();
    var accordionControl = 'file' + fileIndex + '_content';

    lastRow.after('<div class="row"><div class="small-8 columns">' +
        '<ul class="accordion" data-accordion data-multi-expand="true" data-allow-all-closed="true" role="tablist">' +
        '<li class="accordion-item" data-accordion-item>' +
        '<a class="accordion-title" href="#' + accordionControl + '" id="file' + fileIndex + '" role="tab" aria-controls="' + accordionControl + '">' + fileName + '</a>' +
        '<div class="accordion-content" id="' + accordionControl + '" data-tab-content role="tabpanel" aria-labelled-by="file' + fileIndex + '">' +
        '<textarea id="code' + fileIndex + '" class="code"></textarea>' +
        '<div class="text-right"><a href="edit.html?' + fileName + '" class="small button fileEdit">View</a>' +
        '</div></div></li></ul></div>' +
        '<div class="small-2 columns"><p class="text-center">' + fileScore + '</p></div>' +
        '<div class="small-2 columns"><p class="text-center">' + mutantsSurvived + '</p></div></div>');
}

// Add new editor tab for mutant
function createTab(fileName, mutantIndex)
{
	var tabList     = $('ul.tabs');
	var tabContents = $('div.tabs-content');
	
	tabList.append('<li class="tabs-title" role="presentation"><a href="#mutant' + mutantIndex + '" role="tab" aria-controls="mutant' + mutantIndex + '" id="mutant-' + mutantIndex + '">' + fileName + '</a></li>');
	tabContents.append('<div class="tabs-panel" id="mutant' + mutantIndex + '" aria-hidden="false"><textarea id="mutText' + mutantIndex + '"></textarea>');
	
	return;
}

// Move the view of editor so that given line is at the top, with padding of 5 lines
function focusLine(editor, line)
{
    var topLine    = line-5; //Give 5 lines of context
    var distTop    = editor.charCoords({line: topLine, ch: 0}, 'local').top;
    var lineHeight = parseFloat($('.CodeMirror-code').css('line-height'));
    var scrollPos  = distTop - lineHeight;

    editor.scrollTo(null, scrollPos);
    return;
}

// Return the current data-mutant-line, i.e. the currently analysed mutants
function getCurrentMutants()
{
    return $('#original').data('mutant-line');
}

// Add mutants to page when click on mutant line
function enableClicks(fileName)
{
	$('.mutants').click(function(cm)
	{
		// When click concentration of mutants, need to open them in new tabs
                var currentlyShown = getCurrentMutants();
		var currentLine = $(this).parents('.CodeMirror-line').prev('.CodeMirror-gutter-wrapper')[0].innerText;

                if (currentLine == currentlyShown)
                {
                    return;
                }

                var fileResults = fileName + '-mutants.json?b';

                $.getJSON('../data/' + fileResults, function(data)
                {
                    var mutants     = data[currentLine]['files'];
                    var begin       = {line: currentLine-1, ch: null};
                    var end         = {line: currentLine-1, ch: null};
                    var markOptions = {
                        css: 'background: rgba(255, 255, 0, 0.5);'
                    };

                    for(var i = 0; i < mutants.length; ++i)
                    {
                        var mutantName = mutants[i];
                        var filePath   = '../event_bus/mutants/' + mutantName + '?x';
                        var mutantText = 'mutText' + i;
                        
                        createTab(mutantName, i);
                        
                        readFile(
                            filePath, 
                            function(responseText, mutantText)
                            {
                                var editor   = createCodeEditor(mutantText, responseText);
                                var titlePos = parseInt(mutantText.slice(-1)) + 1;
                                var titleElement = $('.tabs-title')[titlePos];
                                var lineMark = {};
                                lineMark[currentLine] = [0, null, 0.5];
                                markLines(lineMark, editor, 'yellow');

                                focusLine(editor, currentLine);

                                editor.on('update', function()
                                {
                                    focusLine(editor, currentLine);
                                });
                            }, 
                            mutantText
                        );
                    }

                    $('#original').attr('data-mutant-line', currentLine);
                    focusLine($('.CodeMirror')[0].CodeMirror, currentLine);
                    addCloseButton();
                });
	});
}

// Replace sidebar with Close button
function addCloseButton()
{
    // Remove mutant information
    var sidebar = $('#sidebar').empty();
    sidebar.html('<a class="alert button" id="closeMutants">Close Mutants</a>');

    $('#closeMutants').click(function()
    {
        closeMutants();
        addInfo();
        $('#original').attr('data-mutant-line', 0);
        $('#original-label').click();

        var args = getUrlArgs();
        buildEditorSidebar(args.viewType, args.currentFile);
    });
}

// Remove all open mutants
function closeMutants()
{
    // Find tabs
    var tabTitles = $('li a[id^=mutant-]').parents('li');
    tabTitles.remove();

    var mutantContents = $('div[id^=mutant]');
    mutantContents.remove();
}

// Remove Close button and associated elements
function addInfo()
{
    var sidebar = $('#sidebar').empty();
}

// Get all operators of surviving mutants
function getOperatorList(subfilter = '')
{
    var operators = {};

    $.getJSON('../data/eventbus_operators.json', function(data)
    {
        $.each(data, function(key, val)
        {
            var operatorDesc = getNiceOperator(key);

            if (!operatorDesc)
            {
                return;
            }

            operators[key] = [operatorDesc, val.mutants];
        });

        buildOperatorFilter(operators);

        if (subfilter.length > 0)
        {
            $('.subFilter#' + subfilter).addClass('selected');
        }

        $('.subFilter:not(.selected)').find('.badge').addClass('secondary');
    });
}

// Build the filter list of operators - we only want ones with surviving mutants
function buildOperatorFilter(operatorList)
{
    var filterList = $('div.filter ul');

    $.each(operatorList, function(key, val)
    {
        var opDesc  = val[0];
        var mutants = val[1];

        filterList.append('<a href="?operator=' + key + '"><li class="subFilter" id="' + key + '"><span>' + opDesc + '</span><span class="float-right"><span class="badge">' + mutants + '</span></span></li></a>');
    });
}

// Return readable version of mutation operator keys
function getNiceOperator(operatorCode)
{
    switch (operatorCode.toLowerCase())
    {
        case 'aoru':
            return 'Arithmetic Op Replace (Unary)';
            break;
        case 'coi':
            return 'Conditional Operator Insertion';
            break;
        default:
            return '';
            break;
    }
}

// Select whether need sidebar with lines or operators
function buildEditorSidebar(viewType, sourceFile)
{
    if (viewType == 'line')
    {
        buildLocationSidebar(sourceFile);
    }
    else
    {
        buildOperatorSidebar(viewType, sourceFile);
    }

    return;
}

// Create sidebar with line-based info
function buildLocationSidebar(sourceFile)
{
    var sidebar     = $('#sidebar');
    var jsonFile    = '../data/' + sourceFile + '-mutants.json';
    var sideContent = '';

    $.getJSON(jsonFile, function(data)
    {
        $.each(data, function(key, val)
        {
            var desc    = 'Line ' + key;
            var mutants = parseInt(val.mutants);
            
            sideContent += '<p class="sidebarLine" id="line' + key + '">' + desc + ' <small><span class="label">' + mutants + '</span></small></p>';
        });

        sidebar.html(sideContent);

       var sidebarLines = $('.sidebarLine');

        sidebarLines.click(function()
        {
            var lineNumber = parseInt(this.id.split('line')[1]);
            focusLine($('.CodeMirror')[0].CodeMirror, lineNumber);
        });
    });
}

// Create sidebar with mutation operator based info
function buildOperatorSidebar(viewType, sourceFile)
{
    var sidebar      = $('#sidebar');
    var jsonFile     = '../data/' + sourceFile + '-operators.json?x';
    var totalMutants = 0;
    var sideContent  = '';

    $.getJSON(jsonFile, function(data)
    {
        $.each(data, function(key, val)
        {
            var desc    = getNiceOperator(key);
            var mutants = parseInt(val.mutants);

            sideContent += '<a href="edit.html?' + sourceFile + '&operator=' + key + '"><p ';
            
            if (viewType.toLowerCase() == key.toLowerCase())
            {
                sideContent += 'class="selected">';
            }
            else
            {
                sideContent += '>';
            }

            sideContent += desc + ' <small><span class="label">' + mutants + '</span></small></p></a>';
            totalMutants += mutants;
        });

        var all;

        if (viewType == 'all')
        {
            all = '<a href="edit.html?' + sourceFile + '&operator=all"><p class="selected">All <small><span class="label">' + totalMutants + '</span></small></a></p>' + sideContent;
        }
        else
        {
            all = '<a href="edit.html?' + sourceFile + '&operator=all"><p>All <small><span class="label">' + totalMutants + '</span></small></p></a>' + sideContent;
        }

        sidebar.html(all);
    });
}

// Get file and filter arguments from URL
function getUrlArgs()
{
    var urlArgs      = location.search.substring(1).split('&');
    var currentFile  = urlArgs[0];
    var operatorType = null;

    if (urlArgs.length > 1)
    {
        operatorType = urlArgs[1].split('=')[1];
    }

    var viewType = operatorType == null ? 'line' : operatorType;

    return {
        'currentFile': currentFile,
        'viewType': viewType
    };
}
